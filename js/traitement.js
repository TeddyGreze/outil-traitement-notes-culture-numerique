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

  // Construction dynamique des notes
  // - On boucle sur toutes les composantes actives
  // - Chaque composante ajoute sa contribution à la note finale
  function getMapResultatComposante(composante) {
    if (!composante || !composante.resultat) return new Map();

    if (composante.typeCalcul === "pix") {
      return composante.resultat.parEtudiant instanceof Map
        ? composante.resultat.parEtudiant
        : new Map();
    }

    return composante.resultat.map instanceof Map
      ? composante.resultat.map
      : new Map();
  }

  function getContributionComposante(composante, item) {
    if (!composante || !item) return 0;

    const poids = Number.isFinite(composante.poids) ? composante.poids : 0;

    if (composante.typeCalcul === "pix") {
      const note = item.noteComposante ?? 0;
      return Number.isFinite(note) ? note : 0;
    }

    if (composante.typeCalcul === "presence") {
      let score5 = item.score5 ?? 0;
      if (!Number.isFinite(score5)) score5 = 0;

      return Math.min(poids, Math.max(0, (score5 / 5) * poids));
    }

    if (composante.typeCalcul === "note20") {
      const note = item.noteComposante ?? 0;
      return Number.isFinite(note) ? note : 0;
    }

    return 0;
  }

  function assurerEtudiantNotes(notes, id, item) {
    let etu = notes.get(id);

    if (!etu) {
      etu = {
        id,
        nom: "",
        prenom: "",
        notesParComposante: {},
        sourcesParComposante: {},
        noteFinale: 0
      };
      notes.set(id, etu);
    }

    if (item?.nom && !etu.nom) etu.nom = item.nom;
    if (item?.prenom && !etu.prenom) etu.prenom = item.prenom;

    return etu;
  }

  CN.traitement.construireNotesDynamiques = function (config, composantes) {
    const notes = new Map();
    const compsActives = (composantes || []).filter(c => c && c.actif);

    // Index générique des ids présents par composante
    const idsParComposante = {};

    for (const comp of compsActives) {
      const idsComp = new Set();
      idsParComposante[comp.id] = idsComp;

      const mapComp = getMapResultatComposante(comp);

      for (const [id, item] of mapComp.entries()) {
        idsComp.add(id);

        const etu = assurerEtudiantNotes(notes, id, item);
        const contribution = getContributionComposante(comp, item);

        etu.notesParComposante[comp.id] = contribution;

        if (Array.isArray(item?.sources)) {
          etu.sourcesParComposante[comp.id] = item.sources.slice();
        }
      }
    }

    // Calcul de la note finale à partir de toutes les composantes actives
    for (const etu of notes.values()) {
      const noteFinaleBrute = compsActives.reduce((acc, comp) => {
        const noteComp = etu.notesParComposante?.[comp.id];
        return acc + (Number.isFinite(noteComp) ? noteComp : 0);
      }, 0);

      const noteFinaleBornee = Math.min(20, Math.max(0, noteFinaleBrute));

      // Si l’arrondi est désactivé, on garde la note brute
      if (config.arrondiActif === false) {
        etu.noteFinale = noteFinaleBornee;
      } else {
        etu.noteFinale = CN.data.arrondirSelonConfig(
          noteFinaleBornee,
          config.arrondiPrecision,
          config.arrondiMethode
        );
      }
    }

    return {
      notes,
      idsParComposante
    };
  };

  function getLibelleComposante(comp) {
    return (comp?.nom || comp?.id || "Composante").toString().trim();
  }

  function normaliserSourceAnomalieComposante(comp) {
    if (!comp) return "COMPOSANTE";

    if (comp.typeCalcul === "pix") return "PIX";
    if (comp.typeCalcul === "presence") return "PRESENCES";

    if (comp.typeCalcul === "note20") {
      if (comp.id === "rd") return "RECHERCHE_DOC";

      return (comp.id || comp.nom || "NOTE20")
        .toString()
        .trim()
        .toUpperCase()
        .replace(/\s+/g, "_");
    }

    return (comp.id || comp.nom || "COMPOSANTE")
      .toString()
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "_");
  }

  function raisonsPixToTexte(setRaisons) {
    const s = setRaisons instanceof Set ? setRaisons : new Set();
    const parts = [];
    if (s.has("PARCOURS_NON_TERMINE")) parts.push("parcours non terminé (progression < 100%)");
    if (s.has("RESULTATS_NON_PARTAGES")) parts.push("résultats non partagés");
    if (s.has("SCORE_MANQUANT")) parts.push("score manquant");
    return parts.join(" et ");
  }

  function construireMessageComposanteManquante(comp, resultatComp, id, causesTexte) {
    const libelle = getLibelleComposante(comp);
    let msg = "";

    // Cas spécial PIX : on garde la logique métier spécifique
    if (comp?.typeCalcul === "pix") {
      msg = `${libelle} manquant: l'étudiant n'apparaît pas dans le fichier ${libelle}.`;

      if (resultatComp?.nonEligibles?.has(id)) {
        const info = resultatComp.nonEligibles.get(id);
        const why = raisonsPixToTexte(info?.raisons);
        msg = `${libelle} manquant: l'étudiant apparaît dans le fichier ${libelle} mais n'est pas pris en compte (${why || "conditions non remplies"}).`;
      }

      return msg + causesTexte;
    }

    // Cas présence : multi-fichiers
    if (comp?.typeCalcul === "presence") {
      msg = comp?.multiFichiers
        ? `${libelle} manquant: l'étudiant n'apparaît dans aucun des fichiers importés pour cette composante.`
        : `${libelle} manquant: l'étudiant n'apparaît pas dans le fichier ${libelle}.`;

      return msg + causesTexte;
    }

    // Cas générique note /20 et autres futurs types
    msg = comp?.multiFichiers
      ? `${libelle} manquant: l'étudiant n'apparaît dans aucun des fichiers importés pour cette composante.`
      : `${libelle} manquant: l'étudiant n'apparaît pas dans le fichier ${libelle}.`;

    return msg + causesTexte;
  }

  // Analyse des anomalies
  // - NUM_ETUDIANT_INVALIDE : N° étudiant non conforme (8 chiffres)
  // - INCONNU_PEGASE        : étudiant avec note mais absent de PEGASE
  // - COMPOSANTE_MANQUANTE  : composante active mais pas de donnée pour cet étudiant
  CN.traitement.analyserAnomalies = function (pegase, mappingPegase, composantes, buildNotesResult) {
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

    const composantesActives = (composantes || []).filter(c => c && c.actif);

    // Causes possibles (quand un id invalide a une suggestion qui correspond à un vrai id PEGASE)
    const causesParId = new Map();

    function addCause(idCorrect, comp, inv) {
      const pid = (idCorrect ?? "").toString().trim();
      if (!CN.data.estNumeroEtudiantValide(pid)) return;

      if (!causesParId.has(pid)) causesParId.set(pid, []);
      causesParId.get(pid).push({
        composanteId: comp?.id || "",
        source: inv?.source || "",
        fichier: inv?.fichier || "",
        idTrouve: inv?.idTrouve || ""
      });
    }

    function causesTextePour(id, comp) {
      const arr = causesParId.get(id) || [];
      const filt = arr.filter(x => x.composanteId === comp?.id);
      if (!filt.length) return "";

      const exemples = filt
        .slice(0, 2)
        .map(x => `${x.idTrouve}${x.fichier ? ` (fichier: ${x.fichier})` : ""}`)
        .join(" ; ");

      return ` Cause possible: numéro étudiant invalide dans ${getLibelleComposante(comp)} (id trouvé: ${exemples}).`;
    }

    // 1) Invalides par composante (boucle dynamique)
    for (const comp of composantesActives) {
      const resultatComp = comp.resultat;
      const invalidesBruts = Array.isArray(resultatComp?.invalides) ? resultatComp.invalides : [];

      const invalidesCorriges = CN.traitement.proposerCorrectionsInvalides(
        invalidesBruts,
        idxParNomPrenom,
        colIdPegase
      );

      for (const inv of invalidesCorriges) {
        if (inv?.propositionId) addCause(inv.propositionId, comp, inv);

        anomalies.push({
          type: "NUM_ETUDIANT_INVALIDE",
          source: inv.source || normaliserSourceAnomalieComposante(comp),
          fichier: inv.fichier || "",
          idTrouve: inv.idTrouve || "",
          nom: inv.nom || "",
          prenom: inv.prenom || "",
          propositionId: inv.propositionId || "",
          message: inv.message || `Numéro étudiant invalide (${getLibelleComposante(comp)}).`,
        });
      }
    }

    // 2) N° étudiants présents dans PEGASE
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

    // 3) Composantes manquantes (boucle dynamique)
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

      for (const comp of composantesActives) {
        const idsComp = buildNotesResult?.idsParComposante?.[comp.id] instanceof Set
          ? buildNotesResult.idsParComposante[comp.id]
          : new Set();

        if (idsComp.has(id)) continue;

        const resultatComp = comp.resultat;
        const msg = construireMessageComposanteManquante(
          comp,
          resultatComp,
          id,
          causesTextePour(id, comp)
        );

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

    // 4) Index anomalies par N° étudiant
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
  function formaterNoteCSV(note, modeleNote, delim, config) {
    const modele = (modeleNote ?? "").toString();
    const utiliserVirgule = modele.includes(",") || (!modele.includes(".") && delim === ";");

    return CN.data.formaterNoteSelonConfig(
      note,
      config,
      utiliserVirgule ? "," : "."
    );
  }

  function normaliserModeRemplissage(mode) {
    const m = (mode ?? "").toString().trim();

    const modesAutorises = new Set([
      "ne_rien_ecraser",
      "ecraser_systematiquement",
      "si_nouvelle_superieure",
      "si_ancienne_lt10_et_nouvelle_gt10"
    ]);

    return modesAutorises.has(m) ? m : "ne_rien_ecraser";
  }

  function peutRemplacerNote(valeurExistante, nouvelleNote, modeRemplissage) {
    if (celluleVide(valeurExistante)) return true;

    const mode = normaliserModeRemplissage(modeRemplissage);

    if (mode === "ne_rien_ecraser") {
      return false;
    }

    if (mode === "ecraser_systematiquement") {
      return true;
    }

    const ancienneNote = CN.data.toNombreFR(valeurExistante);
    const ancienneNoteValide = Number.isFinite(ancienneNote);
    const nouvelleNoteValide = Number.isFinite(nouvelleNote);

    if (!ancienneNoteValide || !nouvelleNoteValide) {
      return false;
    }

    if (mode === "si_nouvelle_superieure") {
      return nouvelleNote > ancienneNote;
    }

    if (mode === "si_ancienne_lt10_et_nouvelle_gt10") {
      return ancienneNote < 10 && nouvelleNote > 10;
    }

    return false;
  }

  CN.traitement.remplirPegase = function (pegase, mappingPegase, notes, config) {
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
    const mode = normaliserModeRemplissage(config?.modeRemplissage);

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

      const valeurExistante = r[mappingPegase.colNote];

      // Si on remplit NOTE_SESSION_2: si NOTE_SESSION_1 >= 10, on ne remplit pas la session 2
      if (sessionCible === 2 && colSession1) {
        const s1 = CN.data.toNombreFR(r[colSession1]);
        if (Number.isFinite(s1) && s1 >= 10) {
          nbIgnores++;
          continue;
        }
      }

      const n = notes.get(id);

      // Si l'étudiant a une note calculée
      if (n) {
        if (peutRemplacerNote(valeurExistante, n.noteFinale, mode)) {
          r[mappingPegase.colNote] = formaterNoteCSV(n.noteFinale, modeleNote, delim, config);
          nbEcrits++;
        } else {
          nbIgnores++;
        }
        continue;
      }

      // Si l'étudiant n'a pas de note calculée, on met ABI seulement si la cellule est vide
      if (celluleVide(valeurExistante)) {
        r[mappingPegase.colNote] = "ABI";
        nbABI++;
      } else {
        nbIgnores++;
      }
    }

    // Liste des N°étudiants présents dans les notes mais pas dans PEGASE
    for (const id of idsNotes) {
      if (!idsPegase.has(id)) inconnus.push(id);
    }

    return { lignesOut, nbEcrits, nbIgnores, nbABI, inconnus };
  };
})();