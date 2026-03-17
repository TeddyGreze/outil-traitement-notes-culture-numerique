/*
   commun.js - Base du projet
   - Centralise les éléments HTML (CN.el)
   - Centralise l’état global (CN.etat)
   - Fournit 4 fonctions UI (messages / affichage / dropzones)
*/
(function () {
  "use strict";

  const CN = (window.CN = window.CN || {});

  // Références
  CN.el = {
    // Paramétrage (cases + pondérations)
    usePix: document.getElementById("usePix"),
    usePres: document.getElementById("usePres"),
    useRD: document.getElementById("useRD"),
    ptsPix: document.getElementById("ptsPix"),
    ptsPres: document.getElementById("ptsPres"),
    ptsRD: document.getElementById("ptsRD"),
    sumPoints: document.getElementById("sumPoints"),
    configError: document.getElementById("configError"),

    // Avertissement navigateur
    safariWarning: document.getElementById("safariWarning"),

    // Inputs fichiers
    fichierPegase: document.getElementById("fichierPegase"),
    fichierPix: document.getElementById("fichierPix"),
    fichiersPresences: document.getElementById("fichiersPresences"),
    fichierRD: document.getElementById("fichierRD"),

    // Textes affichés dans les dropzones
    dzPegaseName: document.getElementById("dzPegaseName"),
    dzPixName: document.getElementById("dzPixName"),
    dzPresName: document.getElementById("dzPresName"),
    dzRDName: document.getElementById("dzRDName"),

    // Cartes imports (pour afficher/masquer selon config)
    blocPix: document.getElementById("blocPix"),
    blocPresences: document.getElementById("blocPresences"),
    blocRD: document.getElementById("blocRD"),

    btnAbout: document.getElementById("btnAbout"),
    aboutOverlay: document.getElementById("aboutOverlay"),
    btnAboutClose: document.getElementById("btnAboutClose"),
    btnAboutOk: document.getElementById("btnAboutOk"),
    aboutBody: document.getElementById("aboutBody"),

    // Boutons principaux + zone messages
    btnAnalyser: document.getElementById("btnAnalyser"),
    btnReinitialiser: document.getElementById("btnReinitialiser"),
    zoneMessages: document.getElementById("zoneMessages"),

    // Boutons mapping (paramétrage colonnes)
    btnCfgPegase: document.getElementById("btnCfgPegase"),
    btnCfgPix: document.getElementById("btnCfgPix"),
    btnCfgPres: document.getElementById("btnCfgPres"),
    btnCfgRD: document.getElementById("btnCfgRD"),

    // Résultats + filtres
    zoneResultats: document.getElementById("zoneResultats"),
    resume: document.getElementById("resume"),

    recherche: document.getElementById("recherche"),
    filtreAnomalies: document.getElementById("filtreAnomalies"),

    // Tableaux (aperçu + anomalies)
    tableApercuHead: document.querySelector("#tableApercu thead"),
    tableApercuBody: document.querySelector("#tableApercu tbody"),

    tableAnomaliesHead: document.querySelector("#tableAnomalies thead"),
    tableAnomaliesBody: document.querySelector("#tableAnomalies tbody"),

    // Exports
    btnExportPegase: document.getElementById("btnExportPegase"),
    btnExportAnomalies: document.getElementById("btnExportAnomalies"),
    btnExportCalcul: document.getElementById("btnExportCalcul"),

    // Modal mapping (choix des colonnes)
    modalOverlay: document.getElementById("modalOverlay"),
    modalTitle: document.getElementById("modalTitle"),
    modalHint: document.getElementById("modalHint"),
    btnModalClose: document.getElementById("btnModalClose"),
    btnModalCancel: document.getElementById("btnModalCancel"),
    btnModalSave: document.getElementById("btnModalSave"),

    mapRow1: document.getElementById("mapRow1"),
    mapRow2: document.getElementById("mapRow2"),
    mapRow3: document.getElementById("mapRow3"),
    mapRow4: document.getElementById("mapRow4"),
    mapLbl1: document.getElementById("mapLbl1"),
    mapLbl2: document.getElementById("mapLbl2"),
    mapLbl3: document.getElementById("mapLbl3"),
    mapLbl4: document.getElementById("mapLbl4"),
    mapSel1: document.getElementById("mapSel1"),
    mapSel2: document.getElementById("mapSel2"),
    mapSel3: document.getElementById("mapSel3"),
    mapSel4: document.getElementById("mapSel4"),
  };

  // État global (données importées + mappings + résultats)
  CN.etat = {
    // Config courante (mise à jour par app.js)
    config: {
      usePix: true,
      usePres: true,
      useRD: false,
      ptsPix: 15,
      ptsPres: 5,
      ptsRD: 0,
    },

    // Données importées
    pegase: null,
    pix: null,
    pres: null,
    rdRaw: null,
    rd: null,

    // Mappings choisis (colonnes)
    mappingPegase: { colId: null, colNom: null, colPrenom: null, colNote: null, delimiteur: ";" },
    mappingRD: { colId: null, colNom: null, colPrenom: null, colNote: null },

    // PIX : mapping normal + colonnes avancées (progression/partage)
    mappingPix: { colId: null, colNom: null, colPrenom: null, colScore: null, colProg: null, colShare: null },

    mappingPres: { colId: null, colNom: null, colPrenom: null, colScore5: null },

    // En-têtes mémorisés
    entetesPegase: null,
    entetesPix: null,
    entetesPres: null,
    entetesRD: null,

    // Résultats calculés
    notes: null,
    pegaseRempli: null,
    anomalies: null,
    anomaliesParId: null,
    apercu: null,
    modeSansPegase: false,
  };

  CN.meta = {
    prenom: "Teddy",
    nom: "GREZE",
    version: "1.0.0"
  };

  CN.ui = CN.ui || {};

  // Supprime tous les messages
  CN.ui.viderMessages = function () {
    CN.el.zoneMessages.innerHTML = "";
  };

  // Ajoute un message (info / warn / danger / ok)
  CN.ui.ajouterMessage = function (type, texte, ttlMs) {
    const div = document.createElement("div");
    div.className = `alerte ${type}`;
    div.textContent = texte;
    CN.el.zoneMessages.appendChild(div);

    if (Number.isFinite(ttlMs) && ttlMs > 0) {
      window.setTimeout(() => {
        if (div && div.parentNode) div.remove();
      }, ttlMs);
    }
  };

  // Affiche/masque un bloc en ajoutant/retirant la classe .bloc-cache
  CN.ui.afficherBloc = function (node, visible) {
    if (!node) return;
    node.classList.toggle("bloc-cache", !visible);
  };

  // Met à jour le texte sous les dropzones (nom de fichier / nombre de fichiers)
  CN.ui.setDZText = function (kind, files) {
    if (kind === "peg") CN.el.dzPegaseName.textContent = files?.length ? files[0].name : "Aucun fichier sélectionné";
    if (kind === "pix") CN.el.dzPixName.textContent = files?.length ? files[0].name : "Aucun fichier sélectionné";
    if (kind === "pres") CN.el.dzPresName.textContent = files?.length ? `${files.length} fichier(s) sélectionné(s)` : "Aucun fichier sélectionné";
    if (kind === "rd") CN.el.dzRDName.textContent = files?.length ? files[0].name : "Aucun fichier sélectionné";
  };
})();