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

  // Composante générique "note sur 20" : N° étudiant, Nom, Prénom, Note
  CN.imports.proposerMappingNote20 = function (entetes, lignes = [], baremeSource = 20) {
    const dejaPris = new Set();
    const baremeTxt = String(Number(CN.utils.normaliserBaremeSource(baremeSource, 20))).replace(/\.0+$/, "");

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
      `NOTE /${baremeTxt}`,
      `NOTE/${baremeTxt}`,
      `NOTE SUR ${baremeTxt}`,
      `NOTE ${baremeTxt}`,
      `TOTAL /${baremeTxt}`,
      `TOTAL SUR ${baremeTxt}`,
      `SCORE /${baremeTxt}`,
      `SCORE SUR ${baremeTxt}`,
      `RESULTAT /${baremeTxt}`,
      `RESULTAT SUR ${baremeTxt}`,
      "NOTE RECHERCHE DOCUMENTAIRE",
      "NOTE RECHERCHE",
      "NOTE_RD",
      "NOTE RD",
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

  // Propose automatiquement le mapping selon le type de calcul de la composante
  CN.imports.proposerMappingComposante = function (composante, entetes, lignes = []) {
    const typeCalcul = (composante?.typeCalcul || "").toString().trim().toLowerCase();

    if (typeCalcul === "pix") {
      return CN.imports.proposerMappingPIX(entetes, lignes);
    }

    if (typeCalcul === "presence") {
      return CN.imports.proposerMappingPres(entetes, lignes);
    }

    if (typeCalcul === "note20") {
      return CN.imports.proposerMappingNote20(
        entetes,
        lignes,
        composante?.baremeSource ?? 20
      );
    }

    return {};
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
      const noteComposante = Math.min(pointsPix, Math.max(0, score * pointsPix));

      // si plusieurs lignes : on garde le meilleur score
      const exist = parEtudiant.get(idRaw);
      if (!exist || score > exist.score) {
        parEtudiant.set(idRaw, { id: idRaw, nom, prenom, score, noteComposante });
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

  // Import générique "note sur 20"

  // Lecture brute d'une composante notée sur 20
  CN.imports.chargerNote20Brut = async function (file) {
    const txt = await CN.csv.lireFichierTexte(file);
    const delim = CN.csv.detecterDelimiteur(txt.split("\n")[0] || ";");
    const tab = CN.csv.parserCSV(txt, delim);
    const { entetes, lignes } = CN.csv.tableauVersObjets(tab);
    return { delim, entetes, lignes };
  };

  // Construction d'une composante générique notée sur 20
  // Conversion /20 => /points de la composante
  CN.imports.construireComposanteNote20 = function (
    raw,
    mappingNote20,
    pointsComposante,
    baremeSource,
    nomFichier,
    configArrondi,
    sourceAnomalie = "NOTE20"
  ) {
    const invalides = [];
    const map = new Map();

    const colId = mappingNote20.colId;
    const colNom = mappingNote20.colNom;
    const colPrenom = mappingNote20.colPrenom;
    const colNote = mappingNote20.colNote;

    const bareme = CN.utils.normaliserBaremeSource(baremeSource, 20);

    if (!colId || !colNom || !colPrenom || !colNote) {
      return { ok: false, map, invalides, totalLignes: raw.lignes.length, nbValides: 0 };
    }

    for (const r of raw.lignes) {
      const idRaw = (r[colId] ?? "").toString().trim();
      const nom = (r[colNom] ?? "").toString().trim();
      const prenom = (r[colPrenom] ?? "").toString().trim();
      const note20 = CN.data.toNombreFR(r[colNote]);

      if (!Number.isFinite(note20)) continue;

      const noteSourceBornee = Math.min(bareme, Math.max(0, note20));

      const noteComposante = Math.min(
        pointsComposante,
        Math.max(0, (noteSourceBornee / bareme) * pointsComposante)
      );

      if (!CN.data.estNumeroEtudiantValide(idRaw)) {
        invalides.push({
          source: sourceAnomalie,
          fichier: nomFichier || "",
          idTrouve: idRaw,
          nom,
          prenom,
          note: noteComposante,
          message: `Numéro étudiant invalide (${sourceAnomalie.toLowerCase()}).`,
        });
        continue;
      }

      const exist = map.get(idRaw);
      if (!exist || noteSourceBornee > exist.note20) {
        map.set(idRaw, {
          id: idRaw,
          nom,
          prenom,
          note20: noteSourceBornee,
          baremeSource: bareme,
          noteComposante
        });
      }
    }

    return { ok: true, map, invalides, totalLignes: raw.lignes.length, nbValides: map.size };
  };

  CN.imports.chargerNotes20Multiples = async function (
    files,
    mappingNote20,
    mappingNote20ParFichier,
    pointsComposante,
    baremeSource,
    configArrondi,
    sourceAnomalie = "NOTE20"
  ) {
    const invalides = [];
    const agg = new Map();
    let totalLignes = 0;

    const bareme = CN.utils.normaliserBaremeSource(baremeSource, 20);

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
        a = {
          id,
          nom: "",
          prenom: "",
          notesParFichier: new Map(),
          sources: new Set()
        };
        agg.set(id, a);
      }
      return a;
    }

    for (const f of files) {
      const raw = await CN.imports.chargerNote20Brut(f);
      totalLignes += Array.isArray(raw.lignes) ? raw.lignes.length : 0;

      const auto = CN.imports.proposerMappingNote20(raw.entetes, raw.lignes, bareme);
      const cleFichier = CN.utils.cleFichier(f);
      const mappingSpecifique = mappingNote20ParFichier?.[cleFichier] || null;

      const colId = choisirColonnePourFichier(mappingSpecifique?.colId, mappingNote20?.colId, auto.colId, raw.entetes);
      const colNom = choisirColonnePourFichier(mappingSpecifique?.colNom, mappingNote20?.colNom, auto.colNom, raw.entetes);
      const colPrenom = choisirColonnePourFichier(mappingSpecifique?.colPrenom, mappingNote20?.colPrenom, auto.colPrenom, raw.entetes);
      const colNote = choisirColonnePourFichier(mappingSpecifique?.colNote, mappingNote20?.colNote, auto.colNote, raw.entetes);

      if (!colId || !colNom || !colPrenom || !colNote) {
        invalides.push({
          source: sourceAnomalie,
          fichier: f.name,
          idTrouve: "",
          nom: "",
          prenom: "",
          message: `${sourceAnomalie} : paramétrage requis - colonnes attendues introuvables.`,
        });
        continue;
      }

      for (const r of raw.lignes) {
        const idRaw = (r[colId] ?? "").toString().trim();
        const nom = (r[colNom] ?? "").toString().trim();
        const prenom = (r[colPrenom] ?? "").toString().trim();
        const note20 = CN.data.toNombreFR(r[colNote]);

        if (!Number.isFinite(note20)) continue;

        if (!CN.data.estNumeroEtudiantValide(idRaw)) {
          invalides.push({
            source: sourceAnomalie,
            fichier: f.name,
            idTrouve: idRaw,
            nom,
            prenom,
            note: note20,
            message: `Numéro étudiant invalide (${sourceAnomalie.toLowerCase()}).`,
          });
          continue;
        }

        const a = getAgg(idRaw);
        if (nom && !a.nom) a.nom = nom;
        if (prenom && !a.prenom) a.prenom = prenom;
        a.sources.add(f.name);

        const noteBornee = Math.min(bareme, Math.max(0, note20));
        const prev = a.notesParFichier.get(f.name);

        if (!Number.isFinite(prev) || noteBornee > prev) {
          a.notesParFichier.set(f.name, noteBornee);
        }
      }
    }

    const map = new Map();

    for (const [id, a] of agg.entries()) {
      const sommeNotes20 = Array.from(a.notesParFichier.values())
        .reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0);

      const note20Finale = Math.min(bareme, sommeNotes20);

      const noteComposante = Math.min(
        pointsComposante,
        Math.max(0, (note20Finale / bareme) * pointsComposante)
      );

      map.set(id, {
        id,
        nom: a.nom,
        prenom: a.prenom,
        note20: note20Finale,
        baremeSource: bareme,
        noteComposante,
        sources: Array.from(a.sources),
      });
    }

    return {
      ok: true,
      map,
      invalides,
      totalLignes,
      nbValides: map.size,
      fichiersCount: files.length
    };
  };

  // Import générique d'une composante selon son typeCalcul
  CN.imports.chargerComposante = async function (composante, files, config) {
    const comp = composante || {};
    const typeCalcul = (comp.typeCalcul || "").toString().trim().toLowerCase();
    const listFiles = Array.isArray(files) ? files.filter(Boolean) : [];
    const points = Number.isFinite(comp.poids) ? comp.poids : 0;

    if (typeCalcul === "pix") {
      if (!listFiles.length) {
        return {
          brut: null,
          resultat: { parEtudiant: new Map(), invalides: [], totalLignes: 0, nbValides: 0 }
        };
      }

      return {
        brut: null,
        resultat: await CN.imports.chargerPIX(
          listFiles[0],
          points,
          comp.mapping || {},
          config
        )
      };
    }

    if (typeCalcul === "presence") {
      if (!listFiles.length) {
        return {
          brut: null,
          resultat: { map: new Map(), invalides: [], fichiersCount: 0 }
        };
      }

      return {
        brut: null,
        resultat: await CN.imports.chargerPresences(
          listFiles,
          comp.mapping || {},
          comp.mappingParFichier || {}
        )
      };
    }

    if (typeCalcul === "note20") {
      if (!listFiles.length) {
        return {
          brut: null,
          resultat: { ok: true, map: new Map(), invalides: [], totalLignes: 0, nbValides: 0 }
        };
      }

      const sourceAnomalie = comp.id === "rd"
        ? "RECHERCHE_DOC"
        : ((comp.id || comp.nom || "NOTE20")
          .toString()
          .trim()
          .toUpperCase()
          .replace(/\s+/g, "_"));

      const baremeSource = CN.utils.normaliserBaremeSource(comp.baremeSource, 20);

      // multi-fichiers pour les composantes libres
      if (comp.multiFichiers) {
        return {
          brut: null,
          resultat: await CN.imports.chargerNotes20Multiples(
            listFiles,
            comp.mapping || {},
            comp.mappingParFichier || {},
            points,
            baremeSource,
            config,
            sourceAnomalie
          )
        };
      }

      const brut = await CN.imports.chargerNote20Brut(listFiles[0]);

      const resultat = CN.imports.construireComposanteNote20(
        brut,
        comp.mapping || {},
        points,
        baremeSource,
        listFiles[0].name,
        config,
        sourceAnomalie
      );

      return { brut, resultat };
    }

    throw new Error(`Type de calcul non pris en charge pour la composante « ${comp.nom || comp.id || "inconnue"} ».`);
  };
})();