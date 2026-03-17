/*
   imports.js - Import des fichiers CSV + auto-détection colonnes
   - PEGASE : fichier “référence” (liste étudiants + colonne note à remplir)
   - PIX    : export PIX (filtre progression + partage + score)
   - Présences : fichiers A/B… (score /5)
   - RD     : recherche documentaire (note /20)
*/
(function () {
  "use strict";
  const CN = window.CN;

  CN.imports = CN.imports || {};

  // Lecture des en-têtes
  CN.imports.lireEntetesCSV = async function (file) {
    const txt = await CN.csv.lireFichierTexte(file);
    const delim = CN.csv.detecterDelimiteur(txt.split("\n")[0] || ";");
    const tab = CN.csv.parserCSV(txt, delim);
    const entetes = (tab[0] || []).map(h => (h ?? "").toString().trim());
    return { delim, entetes };
  };

  // Trouver une colonne par “nom possible”
  function detecterColonne(entetes, candidats) {
    const upper = entetes.map(x => CN.data.nettoyerTexte(x));
    for (const cand of candidats) {
      const idx = upper.indexOf(CN.data.nettoyerTexte(cand));
      if (idx !== -1) return entetes[idx];
    }
    return null;
  }

  // Propositions de mapping (auto-détection des colonnes)

  // PEGASE : on essaie d’identifier ID / NOM / PRÉNOM / NOTE
  CN.imports.proposerMappingPegase = function (entetes) {
    const colId = detecterColonne(entetes, ["CODE_APPRENANT", "NUM_ETUDIANT", "NO_ETUDIANT", "N_ETUDIANT", "ETUDIANT"]);
    const colNom = detecterColonne(entetes, ["NOM_FAMILLE", "NOM", "NOM_ETUDIANT"]);
    const colPrenom = detecterColonne(entetes, ["PRENOM", "PRENOMS"]);
    const colNote =
      detecterColonne(entetes, ["NOTE_SESSION_1", "NOTE_SESSION_2", "NOTE", "NOTE_UE"]) ||
      entetes.find(x => CN.data.nettoyerTexte(x).includes("NOTE")) ||
      null;

    // Si rien trouvé, on prend les premières colonnes
    return {
      colId: colId || entetes[0] || null,
      colNom: colNom || entetes[1] || null,
      colPrenom: colPrenom || entetes[2] || null,
      colNote: colNote || entetes[3] || null
    };
  };

  // RD : N° étudiant, Nom, Prénom, Note
  CN.imports.proposerMappingRD = function (entetes) {
    const colId = CN.csv.trouverColonne(entetes, ["N° étudiant", "N° Étudiant", "N_ETUDIANT", "NUM_ETUDIANT"]);
    const colNom = CN.csv.trouverColonne(entetes, ["Nom", "NOM", "NOM_FAMILLE"]);
    const colPrenom = CN.csv.trouverColonne(entetes, ["Prénom", "Prenom", "PRENOM"]);
    const colNote = CN.csv.trouverColonne(entetes, ["Note Recherche", "NOTE_RECHERCHE", "NOTE_RD", "NOTE", "NOTE /20", "NOTE/20"]);
    return { colId, colNom, colPrenom, colNote };
  };

  // PIX : N° étudiant + NOM/PRÉNOM + progression + partage + score
  CN.imports.proposerMappingPIX = function (entetes) {
    const colId = CN.csv.trouverColonne(entetes, ["N° Étudiant", "N° étudiant", "N_ETUDIANT", "NUM_ETUDIANT"]);
    const colNom = CN.csv.trouverColonne(entetes, ["Nom du Participant", "Nom du participant", "Nom"]);
    const colPrenom = CN.csv.trouverColonne(entetes, ["Prénom du Participant", "Prenom du Participant", "Prénom", "Prenom"]);

    const colProg = CN.csv.trouverColonne(entetes, ["% de progression", "progression", "% progression"]);
    const colShare = CN.csv.trouverColonne(entetes, ["Partage (O/N)", "Partage", "Partage O/N"]);
    const colScore = CN.csv.trouverColonne(entetes, [
      "% maitrise de l'ensemble des acquis du profil",
      "% maîtrise de l'ensemble des acquis du profil",
      "% maîtrise",
      "% maitrise",
      "maitrise"
    ]);

    return { colId, colNom, colPrenom, colProg, colShare, colScore };
  };

  // Présences : N° étudiant + NOM/PRÉNOM + score /5
  CN.imports.proposerMappingPres = function (entetes) {
    const colId = CN.csv.trouverColonne(entetes, ["N° étudiant", "N° Étudiant", "N_ETUDIANT", "NUM_ETUDIANT"]);
    const colNom = CN.csv.trouverColonne(entetes, ["Nom", "NOM"]);
    const colPrenom = CN.csv.trouverColonne(entetes, ["Prénom", "Prenom", "PRENOM"]);
    const colScore5 = CN.csv.trouverColonne(entetes, ["Score /5", "SCORE/5", "SCORE /5", "SCORE_5"]);
    return { colId, colNom, colPrenom, colScore5 };
  };

  // Import PEGASE
  CN.imports.chargerPEGASE = async function (file) {
    const txt = await CN.csv.lireFichierTexte(file);
    const delim = CN.csv.detecterDelimiteur(txt.split("\n")[0] || ";");
    const tab = CN.csv.parserCSV(txt, delim);
    const entetes = tab[0].map(h => (h ?? "").toString().trim());

    const lignes = [];
    for (let i = 1; i < tab.length; i++) {
      const row = tab[i];
      if (!row || !row.length) continue;
      const obj = {};
      for (let c = 0; c < entetes.length; c++) obj[entetes[c]] = row[c] ?? "";
      lignes.push(obj);
    }
    return { delim, entetes, lignes };
  };

  // Import PIX (filtré : progression=1 et partage=OUI/O)
  CN.imports.chargerPIX = async function (file, pointsPix, mappingPix) {
    const txt = await CN.csv.lireFichierTexte(file);
    const delim = CN.csv.detecterDelimiteur(txt.split("\n")[0] || ";");
    const tab = CN.csv.parserCSV(txt, delim);
    const { entetes, lignes } = CN.csv.tableauVersObjets(tab);

    const auto = CN.imports.proposerMappingPIX(entetes);

    const colId = mappingPix?.colId || auto.colId;
    const colProg = mappingPix?.colProg || auto.colProg;
    const colShare = mappingPix?.colShare || auto.colShare;
    const colScore = mappingPix?.colScore || auto.colScore;

    // ces 4 colonnes sont indispensables pour calculer PIX
    if (!colId || !colProg || !colShare || !colScore) {
      throw new Error("Fichier PIX : paramétrage requis - colonnes introuvables.");
    }

    const colNomPix = mappingPix?.colNom || auto.colNom || null;
    const colPrenomPix = mappingPix?.colPrenom || auto.colPrenom || null;

    const parEtudiant = new Map();
    const invalides = [];

    const nonEligibles = new Map();

    function addNonEligible(id, nom, prenom, raisons) {
      let e = nonEligibles.get(id);
      if (!e) {
        e = { id, nom: nom || "", prenom: prenom || "", raisons: new Set() };
        nonEligibles.set(id, e);
      }
      for (const r of raisons) e.raisons.add(r);
    }

    for (const r of lignes) {
      const idRaw = (r[colId] ?? "").toString().trim();

      const nom = colNomPix ? (r[colNomPix] ?? "").toString().trim() : "";
      const prenom = colPrenomPix ? (r[colPrenomPix] ?? "").toString().trim() : "";

      const progression = CN.data.toNombreFR(r[colProg]);
      const partage = (r[colShare] ?? "").toString().trim().toUpperCase();
      const score = CN.data.toNombreFR(r[colScore]);

      // ID invalide => anomalies (on garde aussi le nom du fichier)
      if (!CN.data.estNumeroEtudiantValide(idRaw)) {
        invalides.push({
          source: "PIX",
          fichier: file.name,
          idTrouve: idRaw,
          nom,
          prenom,
          message: "Numéro étudiant invalide (PIX).",
        });
        continue;
      }

      // On identifie pourquoi la ligne n’est pas utilisable
      const raisons = [];
      const progOk = (Number.isFinite(progression) && progression === 1);
      const shareOk = (partage === "OUI" || partage === "O");
      const scoreOk = Number.isFinite(score);

      if (!progOk) raisons.push("PARCOURS_NON_TERMINE");
      if (!shareOk) raisons.push("RESULTATS_NON_PARTAGES");
      if (!scoreOk) raisons.push("SCORE_MANQUANT");

      // Si pas eligible, on le note pour expliquer "PIX manquant" plus tard
      if (raisons.length) {
        addNonEligible(idRaw, nom, prenom, raisons);
        continue;
      }

      // Eligible => calcul note
      const notePix = CN.data.arrondi2(score * pointsPix);

      // si plusieurs lignes : on garde le meilleur score
      const exist = parEtudiant.get(idRaw);
      if (!exist || score > exist.score) {
        parEtudiant.set(idRaw, { id: idRaw, nom, prenom, score, notePix });
      }
    }

    return {
      delim,
      entetes,
      totalLignes: lignes.length,
      nbValides: parEtudiant.size,
      parEtudiant,
      invalides,
      nonEligibles,
      nomFichier: file.name
    };
  };

  // Import Présences (plusieurs fichiers possibles)

  CN.imports.chargerPresences = async function (files, mappingPres) {
    const invalides = [];
    const agg = new Map();

    function getAgg(id) {
      let a = agg.get(id);
      if (!a) {
        a = { id, nom: "", prenom: "", scoresParFichier: new Map(), sources: new Set() };
        agg.set(id, a);
      }
      return a;
    }

    // chaque fichier de présence est lu et fusionné
    for (const f of files) {
      const txt = await CN.csv.lireFichierTexte(f);
      const delim = CN.csv.detecterDelimiteur(txt.split("\n")[0] || ";");
      const tab = CN.csv.parserCSV(txt, delim);
      const { entetes, lignes } = CN.csv.tableauVersObjets(tab);

      const auto = CN.imports.proposerMappingPres(entetes);

      const colId = mappingPres?.colId || auto.colId;
      const colNom = mappingPres?.colNom || auto.colNom;
      const colPrenom = mappingPres?.colPrenom || auto.colPrenom;
      const colScore5 = mappingPres?.colScore5 || auto.colScore5;

      // si structure du fichier non reconnue : on note en invalide
      if (!colId || !colNom || !colPrenom || !colScore5) {
        invalides.push({
          source: "PRESENCES",
          fichier: f.name,
          idTrouve: "",
          nom: "",
          prenom: "",
          message: "Présences : paramétrage requis (⚙️) - colonnes attendues introuvables.",
        });
        continue;
      }

      for (const r of lignes) {
        const idRaw = (r[colId] ?? "").toString().trim();
        const nom = (r[colNom] ?? "").toString().trim();
        const prenom = (r[colPrenom] ?? "").toString().trim();
        const score5 = CN.data.toNombreFR(r[colScore5]);

        // N° étudiant invalide => anomalies
        if (!CN.data.estNumeroEtudiantValide(idRaw)) {
          invalides.push({
            source: "PRESENCES",
            fichier: f.name,
            idTrouve: idRaw,
            nom,
            prenom,
            note: Number.isFinite(score5) ? CN.data.arrondi2(Math.min(5, Math.max(0, score5))) : "",
            message: "Numéro étudiant invalide (présences).",
          });
          continue;
        }

        const a = getAgg(idRaw);
        if (nom && !a.nom) a.nom = nom;
        if (prenom && !a.prenom) a.prenom = prenom;
        a.sources.add(f.name);

        // score /5 : on garde le meilleur score pour ce fichier
        if (Number.isFinite(score5)) {
          const s = Math.min(5, Math.max(0, score5));
          const prev = a.scoresParFichier.get(f.name) ?? 0;
          if (s > prev) a.scoresParFichier.set(f.name, s);
        }
      }
    }

    const map = new Map();
    for (const [id, a] of agg.entries()) {
      const sumScores = Array.from(a.scoresParFichier.values())
        .reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);

      const score5 = Math.min(5, sumScores); // borne 0..5

      map.set(id, {
        id,
        nom: a.nom,
        prenom: a.prenom,
        score5: CN.data.arrondi2(score5),
        sources: Array.from(a.sources),
      });
    }
    return { map, invalides, fichiersCount: files.length };
  };

  // Import RD (recherche documentaire)

  // Lecture
  CN.imports.chargerRD_brut = async function (file) {
    const txt = await CN.csv.lireFichierTexte(file);
    const delim = CN.csv.detecterDelimiteur(txt.split("\n")[0] || ";");
    const tab = CN.csv.parserCSV(txt, delim);
    const { entetes, lignes } = CN.csv.tableauVersObjets(tab);
    return { delim, entetes, lignes };
  };

  // Construction RD : convertit la note /20 en pointsRD
  CN.imports.construireRD_depuisRaw = function (rdRaw, mappingRD, pointsRD, nomFichier) {
    const invalides = [];
    const map = new Map();

    const colId = mappingRD.colId;
    const colNom = mappingRD.colNom;
    const colPrenom = mappingRD.colPrenom;
    const colNote = mappingRD.colNote;

    // si mapping incomplet : pas d’import RD
    if (!colId || !colNom || !colPrenom || !colNote) {
      return { ok: false, map, invalides, totalLignes: rdRaw.lignes.length, nbValides: 0 };
    }

    for (const r of rdRaw.lignes) {
      const idRaw = (r[colId] ?? "").toString().trim();
      const nom = (r[colNom] ?? "").toString().trim();
      const prenom = (r[colPrenom] ?? "").toString().trim();
      const note20 = CN.data.toNombreFR(r[colNote]);

      if (!Number.isFinite(note20)) continue;

      // conversion /20 -> /pointsRD
      const noteRD = CN.data.arrondi2((note20 / 20) * pointsRD);

      // N° étudiant invalide => anomalies
      if (!CN.data.estNumeroEtudiantValide(idRaw)) {
        invalides.push({
          source: "RECHERCHE_DOC",
          fichier: nomFichier || "",
          idTrouve: idRaw,
          nom,
          prenom,
          note: noteRD,
          message: "Numéro étudiant invalide (recherche documentaire).",
        });
        continue;
      }

      // si doublons : on garde la meilleure note /20
      const exist = map.get(idRaw);
      if (!exist || note20 > exist.note20) {
        map.set(idRaw, { id: idRaw, nom, prenom, note20, noteRD });
      }
    }

    return { ok: true, map, invalides, totalLignes: rdRaw.lignes.length, nbValides: map.size };
  };
})();