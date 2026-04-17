/*
   commun.js - Base du projet
   - Centralise les éléments HTML (CN.el)
   - Centralise l’état global (CN.etat)
   - Fournit 4 fonctions UI (messages / affichage / dropzones)
*/
(function () {
  "use strict";

  const CN = (window.CN = window.CN || {});

  CN.utils = CN.utils || {};

  // clé unique pour reconnaître un fichier
  CN.utils.cleFichier = function (file) {
    if (!file) return "";
    return `${file.name}__${file.size}__${file.lastModified}`;
  };

  CN.utils.normaliserBaremeSource = function (valeur, defaut = 20) {
    const n = CN.data?.toNombreFR
      ? CN.data.toNombreFR(valeur)
      : Number((valeur ?? "").toString().trim().replace(",", "."));

    if (!Number.isFinite(n) || n <= 0) return defaut;
    return n;
  };  

  CN.utils.creerMappingVidePourType = function (typeCalcul) {
    const type = (typeCalcul || "").toString().trim().toLowerCase();

    if (type === "pix") {
      return {
        colId: null,
        colNom: null,
        colPrenom: null,
        colScore: null,
        colProg: null,
        colShare: null
      };
    }

    if (type === "presence") {
      return {
        colId: null,
        colNom: null,
        colPrenom: null,
        colScore5: null
      };
    }

    return {
      colId: null,
      colNom: null,
      colPrenom: null,
      colNote: null
    };
  };

  CN.utils.mettreAJourTypeComposante = function (comp, typeCalcul) {
    if (!comp) return;

    const type = (typeCalcul || "note20").toString().trim().toLowerCase();

    comp.typeCalcul = type;
    comp.multiFichiers = (type === "presence" || type === "note20") ? !!comp.multiFichiers : false;
    comp.mapping = CN.utils.creerMappingVidePourType(type);
    comp.mappingParFichier = {};
    comp.resultat = null;
    comp.brut = null;

    comp.baremeSource = type === "note20"
      ? CN.utils.normaliserBaremeSource(comp.baremeSource, 20)
      : null;
  };

  CN.utils.creerComposanteLibre = function (index) {
    return {
      id: `comp_${index}`,
      nom: `Composante ${index}`,
      actif: true,
      poids: 0,
      typeCalcul: "note20",
      baremeSource: 20,
      multiFichiers: false,
      mapping: CN.utils.creerMappingVidePourType("note20"),
      mappingParFichier: {},
      resultat: null,
      brut: null
    };
  };

  CN.utils.creerComposantesModeLibreParDefaut = function () {
    const c1 = CN.utils.creerComposanteLibre(1);
    const c2 = CN.utils.creerComposanteLibre(2);

    c1.poids = 10;
    c2.poids = 10;

    return [c1, c2];
  };

  // Crée les composantes du mode classique
  CN.utils.creerComposantesModeClassique = function () {
    return [
      {
        id: "pix",
        nom: "PIX",
        actif: true,
        poids: 15,
        typeCalcul: "pix",
        baremeSource: null,
        multiFichiers: false,
        mapping: CN.utils.creerMappingVidePourType("pix"),
        mappingParFichier: {},
        resultat: null
      },
      {
        id: "pres",
        nom: "Présences",
        actif: true,
        poids: 5,
        typeCalcul: "presence",
        baremeSource: null,
        multiFichiers: true,
        mapping: CN.utils.creerMappingVidePourType("presence"),
        mappingParFichier: {},
        resultat: null
      },
      {
        id: "rd",
        nom: "Recherche documentaire",
        actif: false,
        poids: 0,
        typeCalcul: "note20",
        baremeSource: 20,
        multiFichiers: false,
        mapping: CN.utils.creerMappingVidePourType("note20"),
        mappingParFichier: {},
        resultat: null
      }
    ];
  };

  // Retourne une composante à partir de son id
  CN.utils.getComposanteById = function (id) {
    const comps = CN.etat?.composantes || [];
    return comps.find(c => c && c.id === id) || null;
  };

  // Retourne uniquement les composantes actives
  CN.utils.getComposantesActives = function () {
    const comps = CN.etat?.composantes || [];
    return comps.filter(c => c && c.actif);
  };

  // Indique si on est en mode libre
  CN.utils.estModeLibre = function () {
    return (CN.etat?.modeSaisie || "classique") === "libre";
  };

  // Indique si on est en mode classique
  CN.utils.estModeClassique = function () {
    return !CN.utils.estModeLibre();
  };

  // Références
  CN.el = {
    // Mode de saisie
    modeClassique: document.getElementById("modeClassique"),
    modeLibre: document.getElementById("modeLibre"),
    configClassiqueBox: document.getElementById("configClassiqueBox"),
    configLibreBox: document.getElementById("configLibreBox"),

    // Liste dynamique mode classique
    classicComposantesList: document.getElementById("classicComposantesList"),

    // Mode libre
    freeComposantesList: document.getElementById("freeComposantesList"),
    btnAddComposante: document.getElementById("btnAddComposante"),
    btnOpenParamCalculLibre: document.getElementById("btnOpenParamCalculLibre"),
    sumPointsLibreMirror: document.getElementById("sumPointsLibreMirror"),

    // Imports
    importsGrid: document.getElementById("importsGrid"),
    importsFreeGrid: document.getElementById("importsFreeGrid"),
    classicImportsCards: document.getElementById("classicImportsCards"),

    // Paramétrage
    sumPoints: document.getElementById("sumPoints"),
    configError: document.getElementById("configError"),

    // Avertissement navigateur
    safariWarning: document.getElementById("safariWarning"),

    // Inputs fichiers PEGASE
    fichierPegase: document.getElementById("fichierPegase"),

    // Textes affichés dans les dropzones
    dzPegaseName: document.getElementById("dzPegaseName"),

    // Bouton à propos
    btnAbout: document.getElementById("btnAbout"),
    aboutOverlay: document.getElementById("aboutOverlay"),
    btnAboutClose: document.getElementById("btnAboutClose"),
    btnAboutOk: document.getElementById("btnAboutOk"),
    aboutBody: document.getElementById("aboutBody"),

    // Boutons principaux + zone messages
    btnAnalyser: document.getElementById("btnAnalyser"),
    btnReinitialiser: document.getElementById("btnReinitialiser"),
    zoneMessages: document.getElementById("zoneMessages"),

    // Bouton mapping PEGASE
    btnCfgPegase: document.getElementById("btnCfgPegase"),

    btnClearPegase: document.getElementById("btnClearPegase"),

    btnOpenParamCalcul: document.getElementById("btnOpenParamCalcul"),

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

    // Modal paramètres avancés
    settingsOverlay: document.getElementById("settingsOverlay"),
    btnSettingsClose: document.getElementById("btnSettingsClose"),
    btnSettingsCancel: document.getElementById("btnSettingsCancel"),
    btnSettingsSave: document.getElementById("btnSettingsSave"),
    paramModeRemplissage: document.getElementById("paramModeRemplissage"),
    paramArrondiActif: document.getElementById("paramArrondiActif"),
    paramArrondiMethode: document.getElementById("paramArrondiMethode"),
    paramArrondiPrecision: document.getElementById("paramArrondiPrecision"),
    arrondiPreview: document.getElementById("arrondiPreview"),

    // Modal réglages composante (mode libre)
    compSettingsOverlay: document.getElementById("compSettingsOverlay"),
    compSettingsTitle: document.getElementById("compSettingsTitle"),
    compSettingsHint: document.getElementById("compSettingsHint"),
    btnCompSettingsClose: document.getElementById("btnCompSettingsClose"),
    btnCompSettingsCancel: document.getElementById("btnCompSettingsCancel"),
    btnCompSettingsSave: document.getElementById("btnCompSettingsSave"),
    btnCompSettingsDelete: document.getElementById("btnCompSettingsDelete"),
    compSettingsMulti: document.getElementById("compSettingsMulti"),
    compSettingsBaremeWrap: document.getElementById("compSettingsBaremeWrap"),
    compSettingsBaremeSource: document.getElementById("compSettingsBaremeSource"),

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
    // Mode actuel de configuration
    modeSaisie: "classique",

    // Liste dynamique des composantes
    composantes: CN.utils.creerComposantesModeClassique(),

    // Config courante (mise à jour par app.js)
    config: {
      modeRemplissage: "ne_rien_ecraser",
      arrondiActif: true,
      arrondiMethode: "classique",
      arrondiPrecision: "centieme",
    },

    // Données importées
    pegase: null,

    // Mapping PEGASE
    mappingPegase: { colId: null, colNom: null, colPrenom: null, colNote: null, delimiteur: ";" },

    // En-têtes mémorisés
    entetesPegase: null,

    // Résultats calculés
    notes: null,
    pegaseRempli: null,
    anomalies: null,
    anomaliesParId: null,
    apercu: null,
    modeSansPegase: false,
    analyseDejaLancee: false,

    // Mode libre
    composantesLibres: null,
    compteurComposantesLibres: 2,
    fichiersComposantes: {},

    // Mode classique dynamique
    composantesClassiques: CN.utils.creerComposantesModeClassique(),
    fichiersComposantesClassiques: {},
  };

  CN.meta = {
    prenom: "Teddy",
    nom: "GREZE",
    version: "1.2.0"
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
    let texte = "Aucun fichier sélectionné";

    if (kind === "peg") {
      texte = files?.length ? files[0].name : "Aucun fichier sélectionné";
    }

    document.querySelectorAll(`[data-dz-kind="${kind}"]`).forEach(node => {
      node.textContent = texte;
    });

    if (kind === "peg" && CN.el.dzPegaseName) {
      CN.el.dzPegaseName.textContent = texte;
    }
  };
})();