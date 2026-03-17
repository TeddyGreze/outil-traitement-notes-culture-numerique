/*
   traitement.js - Calcul des notes + détection des anomalies + export PEGASE
   - On combine PIX / Présences / RD pour obtenir une note finale /20
   - On prépare une liste d’anomalies (ID invalide, étudiant hors PEGASE, composante manquante)
   - On remplit la colonne NOTE du fichier PEGASE (si vide), sinon on laisse tel quel
*/
(function () {
  "use strict";
  const CN = window.CN;

  CN.traitement = CN.traitement || {};

  // Index PEGASE par (NOM, PRÉNOM)
  // => sert à proposer un "Suggestion N° étudiant" quand le N° étudiant est invalide
  CN.traitement.indexerPegaseParNomPrenom = function (pegase, mappingPegase) {
    const idx = new Map();

    if (
      !pegase ||
      !Array.isArray(pegase.lignes) ||
      !mappingPegase ||
      !mappingPegase.colNom ||
      !mappingPegase.colPrenom
    ) {
      return idx;
    }

    for (const r of pegase.lignes) {
      const nom = (r[mappingPegase.colNom] ?? "").toString().trim();
      const prenom = (r[mappingPegase.colPrenom] ?? "").toString().trim();
      const key = `${CN.data.nettoyerTexte(nom)}|${CN.data.nettoyerTexte(prenom)}`;
      if (!idx.has(key)) idx.set(key, []);
      idx.get(key).push(r);
    }
    return idx;
  };

  // 2) Proposition de correction pour les N° étudiants invalides
  //    - Si (Nom, Prénom) correspond à 1 seul étudiant PEGASE => suggestion = son N° étudiant
  //    - Sinon => pas de suggestion
  CN.traitement.proposerCorrectionsInvalides = function (invalides, idxParNomPrenom, colIdPegase) {
    const out = [];

    if (!colIdPegase || !idxParNomPrenom) {
      return (invalides || []).map(inv => ({ ...inv }));
    }

    for (const inv of invalides) {
      const nom = (inv.nom ?? "").toString().trim();
      const prenom = (inv.prenom ?? "").toString().trim();
      const key = `${CN.data.nettoyerTexte(nom)}|${CN.data.nettoyerTexte(prenom)}`;
      const candidats = idxParNomPrenom.get(key) || [];

      if (candidats.length === 1) {
        const r = candidats[0];
        const idCorrect = (r[colIdPegase] ?? "").toString().trim();
        out.push({ ...inv, propositionId: idCorrect });
      } else {
        out.push({ ...inv });
      }
    }
    return out;
  };

  // Construction des notes
  // - On crée une entrée par étudiant dès qu’il apparaît dans une composante
  // - Puis on calcule : notePres / noteRD / notePix / noteFinale
  CN.traitement.construireNotes = function (config, pix, pres, rd) {
    const notes = new Map();

    const idsPix = new Set();
    const idsPres = new Set();
    const idsRD = new Set();

    // base depuis PIX
    if (config.usePix && pix) {
      for (const [id, p] of pix.parEtudiant.entries()) {
        idsPix.add(id);
        notes.set(id, {
          id,
          nom: p.nom || "",
          prenom: p.prenom || "",
          notePix: p.notePix ?? 0,
          notePres: 0,
          noteRD: 0,
          noteFinale: 0,
          sourcesPres: [],
        });
      }
    }

    // fusion depuis Présences
    if (config.usePres && pres) {
      for (const [id, pr] of pres.map.entries()) {
        idsPres.add(id);
        const exist = notes.get(id);
        if (!exist) {
          notes.set(id, {
            id,
            nom: pr.nom || "",
            prenom: pr.prenom || "",
            notePix: 0,
            notePres: 0,
            noteRD: 0,
            noteFinale: 0,
            sourcesPres: pr.sources || [],
            scorePresence5: pr.score5 ?? 0,
          });
        } else {
          exist.sourcesPres = pr.sources || [];
          exist.scorePresence5 = pr.score5 ?? 0;
        }
      }
    }

    // fusion depuis RD
    if (config.useRD && rd) {
      for (const [id, r] of rd.map.entries()) {
        idsRD.add(id);
        const exist = notes.get(id);
        if (!exist) {
          notes.set(id, {
            id,
            nom: r.nom || "",
            prenom: r.prenom || "",
            notePix: 0,
            notePres: 0,
            noteRD: r.noteRD ?? 0,
            noteFinale: 0,
            sourcesPres: [],
          });
        } else {
          exist.noteRD = r.noteRD ?? 0;
        }
      }
    }

    // calcul final des composantes + total
    for (const v of notes.values()) {
      // Présences : score /5 => conversion selon la pondération
      if (config.usePres && pres) {
        const pr = pres.map.get(v.id);
        let score5 = pr ? (pr.score5 ?? 0) : 0;
        if (!Number.isFinite(score5)) score5 = 0;

        let ptsPres = config.ptsPres;
        if (!Number.isFinite(ptsPres)) ptsPres = 0;

        v.notePres = CN.data.arrondi2((score5 / 5) * ptsPres);
      } else v.notePres = 0;

      // RD : déjà converti dans imports (noteRD)
      if (config.useRD && rd) {
        const rr = rd.map.get(v.id);
        v.noteRD = rr ? (rr.noteRD ?? 0) : 0;
      } else v.noteRD = 0;

      // PIX : déjà calculé dans imports (notePix)
      v.notePix = config.usePix && pix ? (pix.parEtudiant.get(v.id)?.notePix ?? 0) : 0;

      // total /20
      v.noteFinale = CN.data.arrondi2((v.notePix || 0) + (v.notePres || 0) + (v.noteRD || 0));
    }

    return { notes, idsPix, idsPres, idsRD };
  };

  // Analyse des anomalies
  // - NUM_ETUDIANT_INVALIDE : N° étudiant non conforme (8 chiffres)
  // - INCONNU_PEGASE        : étudiant avec note mais absent de PEGASE
  // - COMPOSANTE_MANQUANTE  : composante cochée mais pas de donnée pour cet étudiant
  CN.traitement.analyserAnomalies = function (config, pegase, mappingPegase, pix, pres, rdBuilt, buildNotesResult) {
    const anomalies = [];
    const avecPegase = !!(
      pegase &&
      Array.isArray(pegase.lignes) &&
      mappingPegase &&
      mappingPegase.colId &&
      mappingPegase.colNom &&
      mappingPegase.colPrenom
    );

    const colIdPegase = avecPegase ? mappingPegase.colId : null;
    const colNomPegase = avecPegase ? mappingPegase.colNom : null;
    const colPrenomPegase = avecPegase ? mappingPegase.colPrenom : null;

    const idxParNomPrenom = avecPegase
      ? CN.traitement.indexerPegaseParNomPrenom(pegase, mappingPegase)
      : new Map();

    // N°étudiant invalides provenant des imports (avec suggestion si possible)
    const invPix = config.usePix && pix
      ? CN.traitement.proposerCorrectionsInvalides(pix.invalides, idxParNomPrenom, colIdPegase)
      : [];

    const invPres = config.usePres && pres
      ? CN.traitement.proposerCorrectionsInvalides(
        pres.invalides.filter(x => x.source === "PRESENCES"),
        idxParNomPrenom,
        colIdPegase
      )
      : [];

    const invRD = config.useRD && rdBuilt
      ? CN.traitement.proposerCorrectionsInvalides(rdBuilt.invalides, idxParNomPrenom, colIdPegase)
      : [];

    // Causes possibles (quand un id invalide a une suggestion qui correspond a un vrai id PEGASE)
    const causesParId = new Map(); // key: idCorrect => Array<{source,fichier,idTrouve}>
    function addCause(idCorrect, inv) {
      const pid = (idCorrect ?? "").toString().trim();
      if (!CN.data.estNumeroEtudiantValide(pid)) return;
      if (!causesParId.has(pid)) causesParId.set(pid, []);
      causesParId.get(pid).push({
        source: inv.source || "",
        fichier: inv.fichier || "",
        idTrouve: inv.idTrouve || ""
      });
    }

    for (const inv of [...invPix, ...invPres, ...invRD]) {
      if (inv?.propositionId) addCause(inv.propositionId, inv);
    }

    function causesTextePour(id, source) {
      const arr = causesParId.get(id) || [];
      const filt = arr.filter(x => (x.source || "").toUpperCase() === (source || "").toUpperCase());
      if (!filt.length) return "";

      const exemples = filt
        .slice(0, 2)
        .map(x => `${x.idTrouve}${x.fichier ? ` (fichier: ${x.fichier})` : ""}`)
        .join(" ; ");

      return ` Cause possible: numéro étudiant invalide dans ${source} (id trouvé: ${exemples}).`;
    }

    function raisonsPixToTexte(setRaisons) {
      const s = setRaisons instanceof Set ? setRaisons : new Set();
      const parts = [];
      if (s.has("PARCOURS_NON_TERMINE")) parts.push("parcours non terminé (progression < 100%)");
      if (s.has("RESULTATS_NON_PARTAGES")) parts.push("résultats non partagés");
      if (s.has("SCORE_MANQUANT")) parts.push("score manquant");
      return parts.join(" et ");
    }

    for (const inv of [...invPix, ...invPres, ...invRD]) {
      anomalies.push({
        type: "NUM_ETUDIANT_INVALIDE",
        source: inv.source || "",
        fichier: inv.fichier || "",
        idTrouve: inv.idTrouve || "",
        nom: inv.nom || "",
        prenom: inv.prenom || "",
        propositionId: inv.propositionId || "",
        message: inv.message || "Numéro étudiant invalide.",
      });
    }

    // N°étudiants présents dans PEGASE
    const pegaseIds = new Set();
    const pegById = new Map();

    if (avecPegase) {
      for (const r of pegase.lignes) {
        const idP = (r[mappingPegase.colId] ?? "").toString().trim();
        if (!idP) continue;

        pegaseIds.add(idP);
        if (!pegById.has(idP)) pegById.set(idP, r);
      }

      // Étudiant avec note mais absent de PEGASE
      for (const id of buildNotesResult.notes.keys()) {
        if (!pegaseIds.has(id)) {
          const n = buildNotesResult.notes.get(id);
          anomalies.push({
            type: "INCONNU_PEGASE",
            source: "CALCUL",
            fichier: "",
            idTrouve: id,
            nom: n?.nom || "",
            prenom: n?.prenom || "",
            message: "Étudiant ayant une note mais absent du fichier PEGASE.",
          });
        }
      }
    }

    // Composante manquante (si composante cochée mais pas de données)
    const idsCibles = new Set([
      ...Array.from(buildNotesResult.notes.keys()),
      ...Array.from(causesParId.keys())
    ]);

    for (const id of idsCibles) {
      const n = buildNotesResult.notes.get(id) || null;

      const rPeg = pegById.get(id) || null;
      const nom = (n?.nom ?? (rPeg && colNomPegase ? (rPeg[colNomPegase] ?? "") : "")) || "";
      const prenom = (n?.prenom ?? (rPeg && colPrenomPegase ? (rPeg[colPrenomPegase] ?? "") : "")) || "";

      const details = [];

      // PIX
      if (config.usePix && !buildNotesResult.idsPix.has(id)) {
        let msg = "PIX manquant: l'étudiant n'apparaît pas dans le fichier PIX.";
        if (pix?.nonEligibles?.has(id)) {
          const info = pix.nonEligibles.get(id);
          const why = raisonsPixToTexte(info?.raisons);
          msg = `PIX manquant: l'étudiant apparaît dans le fichier PIX mais n'est pas pris en compte (${why || "conditions non remplies"}).`;
        }
        msg += causesTextePour(id, "PIX");
        details.push(msg);
      }

      // PRESENCES
      if (config.usePres && !buildNotesResult.idsPres.has(id)) {
        let msg = `Présences manquantes: l'étudiant n'apparaît dans aucun des fichiers de présence importés.`;
        msg += causesTextePour(id, "PRESENCES");
        details.push(msg);
      }

      // RD
      if (config.useRD && !buildNotesResult.idsRD.has(id)) {
        let msg = `RD manquant: l'étudiant n'apparaît pas dans le fichier Recherche documentaire.`;
        msg += causesTextePour(id, "RECHERCHE_DOC");
        details.push(msg);
      }

      if (details.length) {
        anomalies.push({
          type: "COMPOSANTE_MANQUANTE",
          source: "CALCUL",
          fichier: "",
          idTrouve: id,
          nom,
          prenom,
          message: details.join(" | "),
        });
      }
    }

    // Index anomalies par N° étudiant 
    const anomaliesParId = new Map();
    for (const a of anomalies) {
      const id = (a.idTrouve ?? "").toString().trim();
      if (CN.data.estNumeroEtudiantValide(id)) {
        if (!anomaliesParId.has(id)) anomaliesParId.set(id, []);
        anomaliesParId.get(id).push(a);
      }
      const pid = (a.propositionId ?? "").toString().trim();
      if (CN.data.estNumeroEtudiantValide(pid)) {
        if (!anomaliesParId.has(pid)) anomaliesParId.set(pid, []);
        anomaliesParId.get(pid).push(a);
      }
    }

    return { anomalies, anomaliesParId };
  };

  // Remplissage du fichier PEGASE (colonne note)
  // - On écrit la note finale seulement si la cellule est vide
  // - Sinon : on n’écrase pas on ignore
  // - Si étudiant sans note (absent des calculs) : ABI
  function celluleVide(val) {
    return ((val ?? "").toString().trim() === "");
  }

  function detecterNumeroSession(colName) {
    const raw = (colName ?? "").toString().trim();
    if (!raw) return null;

    const norm = CN.data.nettoyerTexte(raw);
    const m = norm.match(/NOTE[_\s-]*SESSION[_\s-]*(\d+)/);
    if (m && m[1]) return Number(m[1]);

    return null;
  }

  function trouverColonneNoteSession(entetes, numeroSession) {
    const n = Number(numeroSession);
    if (!Array.isArray(entetes) || !entetes.length || !Number.isFinite(n)) return null;

    for (const h of entetes) {
      const norm = CN.data.nettoyerTexte(h);
      const m = norm.match(/NOTE[_\s-]*SESSION[_\s-]*(\d+)/);
      if (m && Number(m[1]) === n) return h;
    }
    return null;
  }

  function detecterModeleDecimalPegase(lignesOut, colNote) {
    return lignesOut
      .map(r => (r[colNote] ?? "").toString().trim())
      .find(v => v !== "") || "";
  }

  // Formate en 2 décimales
  function formaterNoteCSV(note, modeleNote, delim) {
    let s = Number(note).toFixed(2);
    const modele = (modeleNote ?? "").toString();
    const utiliserVirgule = modele.includes(",") || (!modele.includes(".") && delim === ";");
    if (utiliserVirgule) s = s.replace(".", ",");
    return s;
  }

  CN.traitement.remplirPegase = function (pegase, mappingPegase, notes) {
    const lignesOut = pegase.lignes.map(r => ({ ...r }));
    let nbEcrits = 0;
    let nbIgnores = 0;
    let nbABI = 0;

    const inconnus = [];
    const idsNotes = new Set(notes.keys());
    const modeleNote = detecterModeleDecimalPegase(lignesOut, mappingPegase.colNote);
    const delim = mappingPegase.delimiteur || ";";
    const sessionCible = detecterNumeroSession(mappingPegase.colNote);
    const colSession1 = (sessionCible === 2) ? trouverColonneNoteSession(pegase.entetes, 1) : null;

    // N°étudiants PEGASE pour repérer ceux qui ont une note mais sont hors PEGASE
    const idsPegase = new Set();
    for (const r of lignesOut) {
      const id = (r[mappingPegase.colId] ?? "").toString().trim();
      if (id) idsPegase.add(id);
    }

    // Remplissage colonne note
    for (const r of lignesOut) {
      const id = (r[mappingPegase.colId] ?? "").toString().trim();
      if (!id) continue;

      // si la cellule note est déjà remplie : on ne touche pas
      if (!celluleVide(r[mappingPegase.colNote])) {
        nbIgnores++;
        continue;
      }

      // Si on remplit NOTE_SESSION_2: si NOTE_SESSION_1 >= 10, on ne remplit pas la session 2
      if (sessionCible === 2 && colSession1) {
        const s1 = CN.data.toNombreFR(r[colSession1]);
        if (Number.isFinite(s1) && s1 >= 10) {
          nbIgnores++;
          continue;
        }
      }

      const n = notes.get(id);
      if (n) {
        r[mappingPegase.colNote] = formaterNoteCSV(n.noteFinale, modeleNote, delim);
        nbEcrits++;
      } else {
        r[mappingPegase.colNote] = "ABI";
        nbABI++;
      }
    }

    // Liste des N°étudiants présents dans les notes mais pas dans PEGASE
    for (const id of idsNotes) {
      if (!idsPegase.has(id)) inconnus.push(id);
    }

    return { lignesOut, nbEcrits, nbIgnores, nbABI, inconnus };
  };
})();