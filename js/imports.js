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

  // Lecture d’un petit aperçu du CSV
  // Sert à améliorer l’auto-détection des colonnes
  CN.imports.lireApercuCSV = async function (file, maxLignes = 30) {
    const txt = await CN.csv.lireFichierTexte(file);
    const delim = CN.csv.detecterDelimiteur(txt.split("\n")[0] || ";");
    const tab = CN.csv.parserCSV(txt, delim);
    const { entetes, lignes } = CN.csv.tableauVersObjets(tab);
    return { delim, entetes, lignes: lignes.slice(0, maxLignes) };
  };

  // Trouver une colonne par “nom possible”
  function detecterColonne(entetes, candidats, lignes, exclude = new Set()) {
    return CN.csv.trouverColonne(entetes, candidats, lignes, { exclude });
  }

  // Renvoie la première colonne non encore utilisée
  function premiereColonneLibre(entetes, dejaPris) {
    for (const h of entetes) {
      if (h && !dejaPris.has(h)) return h;
    }
    return null;
  }

  // Propositions de mapping (auto-détection des colonnes)

  // PEGASE : on essaie d’identifier ID / NOM / PRÉNOM / NOTE
  CN.imports.proposerMappingPegase = function (entetes, lignes = []) {
    const dejaPris = new Set();

    const colId = detecterColonne(entetes, [
      "CODE_APPRENANT",
      "CODE APPRENANT",
      "NUM_ETUDIANT",
      "NUM ETUDIANT",
      "NUMERO ETUDIANT",
      "NO_ETUDIANT",
      "NO ETUDIANT",
      "N_ETUDIANT",
      "N ETUDIANT",
      "N° ETUDIANT",
      "ID ETUDIANT",
      "ETUDIANT"
    ], lignes, dejaPris);

    if (colId) dejaPris.add(colId);

    const colNom = detecterColonne(entetes, [
      "NOM_FAMILLE",
      "NOM FAMILLE",
      "NOM",
      "NOM_ETUDIANT",
      "NOM ETUDIANT"
    ], lignes, dejaPris);

    if (colNom) dejaPris.add(colNom);

    const colPrenom = detecterColonne(entetes, [
      "PRENOM",
      "PRENOMS",
      "PRENOM ETUDIANT"
    ], lignes, dejaPris);

    if (colPrenom) dejaPris.add(colPrenom);

    const colNote =
      detecterColonne(entetes, [
        "NOTE_SESSION_1",
        "NOTE SESSION 1",
        "NOTE_SESSION_2",
        "NOTE SESSION 2",
        "NOTE",
        "NOTE_UE",
        "NOTE UE",
        "MOYENNE",
        "RESULTAT"
      ], lignes, dejaPris) ||
      entetes.find(x => !dejaPris.has(x) && CN.data.nettoyerTexte(x).includes("NOTE")) ||
      null;

    // Si rien trouvé, on prend les premières colonnes libres
    return {
      colId: colId || premiereColonneLibre(entetes, dejaPris) || entetes[0] || null,
      colNom: colNom || premiereColonneLibre(entetes, dejaPris) || entetes[1] || null,
      colPrenom: colPrenom || premiereColonneLibre(entetes, dejaPris) || entetes[2] || null,
      colNote: colNote || premiereColonneLibre(entetes, dejaPris) || entetes[3] || null
    };
  };

  // RD : N° étudiant, Nom, Prénom, Note
  CN.imports.proposerMappingRD = function (entetes, lignes = []) {
    const dejaPris = new Set();

    const colId = detecterColonne(entetes, [
      "N° étudiant",
      "N° Étudiant",
      "NUM_ETUDIANT",
      "NUM ETUDIANT",
      "NUMERO ETUDIANT",
      "N_ETUDIANT",
      "N ETUDIANT",
      "ID ETUDIANT"
    ], lignes, dejaPris);

    if (colId) dejaPris.add(colId);

    const colNom = detecterColonne(entetes, [
      "Nom",
      "NOM",
      "NOM_FAMILLE",
      "NOM FAMILLE"
    ], lignes, dejaPris);

    if (colNom) dejaPris.add(colNom);

    const colPrenom = detecterColonne(entetes, [
      "Prénom",
      "Prenom",
      "PRENOM",
      "PRENOMS"
    ], lignes, dejaPris);

    if (colPrenom) dejaPris.add(colPrenom);

    const colNote = detecterColonne(entetes, [
      "Note Recherche documentaire",
      "NOTE RECHERCHE DOCUMENTAIRE",
      "Note Recherche",
      "NOTE_RECHERCHE",
      "NOTE RECHERCHE",
      "NOTE_RD",
      "NOTE RD",
      "NOTE /20",
      "NOTE/20",
      "NOTE SUR 20",
      "NOTE 20",
      "NOTE"
    ], lignes, dejaPris);

    return { colId, colNom, colPrenom, colNote };
  };

  // PIX : N° étudiant + NOM/PRÉNOM + progression + partage + score
  CN.imports.proposerMappingPIX = function (entetes, lignes = []) {
    const dejaPris = new Set();

    const colId = detecterColonne(entetes, [
      "N° Étudiant",
      "N° étudiant",
      "NUM_ETUDIANT",
      "NUM ETUDIANT",
      "NUMERO ETUDIANT",
      "N_ETUDIANT",
      "N ETUDIANT",
      "ID ETUDIANT"
    ], lignes, dejaPris);

    if (colId) dejaPris.add(colId);

    const colNom = detecterColonne(entetes, [
      "Nom du Participant",
      "Nom du participant",
      "NOM DU PARTICIPANT",
      "NOM PARTICIPANT",
      "Nom",
      "NOM"
    ], lignes, dejaPris);

    if (colNom) dejaPris.add(colNom);

    const colPrenom = detecterColonne(entetes, [
      "Prénom du Participant",
      "Prenom du Participant",
      "PRENOM DU PARTICIPANT",
      "PRENOM PARTICIPANT",
      "Prénom",
      "Prenom",
      "PRENOM"
    ], lignes, dejaPris);

    if (colPrenom) dejaPris.add(colPrenom);

    const colProg = detecterColonne(entetes, [
      "% de progression",
      "% progression",
      "PROGRESSION",
      "TAUX DE PROGRESSION"
    ], lignes, dejaPris);

    if (colProg) dejaPris.add(colProg);

    const colShare = detecterColonne(entetes, [
      "Partage (O/N)",
      "PARTAGE O/N",
      "PARTAGE",
      "PARTAGE OUI NON"
    ], lignes, dejaPris);

    if (colShare) dejaPris.add(colShare);

    const colScore = detecterColonne(entetes, [
      "% maitrise de l'ensemble des acquis du profil",
      "% maîtrise de l'ensemble des acquis du profil",
      "% maitrise",
      "% maîtrise",
      "TAUX DE MAITRISE",
      "MAITRISE",
      "SCORE PIX",
      "SCORE"
    ], lignes, dejaPris);

    return { colId, colNom, colPrenom, colProg, colShare, colScore };
  };

  // Présences : N° étudiant + NOM/PRÉNOM + score /5
  CN.imports.proposerMappingPres = function (entetes, lignes = []) {
    const dejaPris = new Set();

    const colId = detecterColonne(entetes, [
      "N° étudiant",
      "N° Étudiant",
      "NUM_ETUDIANT",
      "NUM ETUDIANT",
      "NUMERO ETUDIANT",
      "N_ETUDIANT",
      "N ETUDIANT",
      "ID ETUDIANT"
    ], lignes, dejaPris);

    if (colId) dejaPris.add(colId);

    const colNom = detecterColonne(entetes, [
      "Nom",
      "NOM",
      "NOM_FAMILLE",
      "NOM FAMILLE"
    ], lignes, dejaPris);

    if (colNom) dejaPris.add(colNom);

    const colPrenom = detecterColonne(entetes, [
      "Prénom",
      "Prenom",
      "PRENOM",
      "PRENOMS"
    ], lignes, dejaPris);

    if (colPrenom) dejaPris.add(colPrenom);

    const colScore5 = detecterColonne(entetes, [
      "Score /5",
      "SCORE/5",
      "SCORE /5",
      "SCORE_5",
      "SCORE SUR 5",
      "NOTE /5",
      "NOTE/5",
      "NOTE SUR 5",
      "RESULTAT /5",
      "RESULTAT SUR 5",
      "POINTS /5",
      "POINTS SUR 5",
      "TOTAL /5",
      "TOTAL SUR 5",
      "SCORE PRESENCE",
      "NOTE PRESENCE",
      "PRESENCE /5"
    ], lignes, dejaPris);

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
  CN.imports.chargerPIX = async function (file, pointsPix, mappingPix, configArrondi) {
    const txt = await CN.csv.lireFichierTexte(file);
    const delim = CN.csv.detecterDelimiteur(txt.split("\n")[0] || ";");
    const tab = CN.csv.parserCSV(txt, delim);
    const { entetes, lignes } = CN.csv.tableauVersObjets(tab);

    const auto = CN.imports.proposerMappingPIX(entetes, lignes);

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

      // Eligible => calcul note brute
      const notePix = Math.min(pointsPix, Math.max(0, score * pointsPix));

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

  CN.imports.chargerPresences = async function (files, mappingPres, mappingPresParFichier) {
    const invalides = [];
    const agg = new Map();

    function choisirColonnePourFichier(colSpecifique, colPartagee, colAuto, entetes) {
      const candidates = [
        (colSpecifique ?? "").toString().trim(),
        (colPartagee ?? "").toString().trim(),
        (colAuto ?? "").toString().trim()
      ].filter(Boolean);

      for (const col of candidates) {
        if (Array.isArray(entetes) && entetes.includes(col)) {
          return col;
        }
      }
      return null;
    }

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

      const auto = CN.imports.proposerMappingPres(entetes, lignes);
      const cleFichier = CN.utils.cleFichier(f);
      const mappingSpecifique = mappingPresParFichier?.[cleFichier] || null;

      const colId = choisirColonnePourFichier(mappingSpecifique?.colId, mappingPres?.colId, auto.colId, entetes);
      const colNom = choisirColonnePourFichier(mappingSpecifique?.colNom, mappingPres?.colNom, auto.colNom, entetes);
      const colPrenom = choisirColonnePourFichier(mappingSpecifique?.colPrenom, mappingPres?.colPrenom, auto.colPrenom, entetes);
      const colScore5 = choisirColonnePourFichier(mappingSpecifique?.colScore5, mappingPres?.colScore5, auto.colScore5, entetes);

      // si structure du fichier non reconnue : on note en invalide
      if (!colId || !colNom || !colPrenom || !colScore5) {
        invalides.push({
          source: "PRESENCES",
          fichier: f.name,
          idTrouve: "",
          nom: "",
          prenom: "",
          message: "Présences : paramétrage requis - colonnes attendues introuvables.",
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
        score5: score5,
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
  CN.imports.construireRD_depuisRaw = function (rdRaw, mappingRD, pointsRD, nomFichier, configArrondi) {
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
      const noteRD = Math.min(pointsRD, Math.max(0, (note20 / 20) * pointsRD));

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