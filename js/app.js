/*
   app.js - Script principal
   - Gère l’interface (boutons, modal, dropzones)
   - Lance l’analyse (imports => calculs => affichage)
   - Gère les exports (PEGASE, anomalies, calcul)
*/
(function () {
  "use strict";
  const CN = window.CN;

  // Organisation
  CN.app = CN.app || {};
  CN.app.util = CN.app.util || {};
  CN.app.modal = CN.app.modal || {};
  CN.app.config = CN.app.config || {};
  CN.app.dropzones = CN.app.dropzones || {};
  CN.app.pipeline = CN.app.pipeline || {};
  CN.app.exports = CN.app.exports || {};
  CN.app.main = CN.app.main || {};

  // Utils

  // Remplit un <select> avec une liste d’options
  CN.app.util.remplirSelect = function (select, options, valeur, maxLen = 42) {
    select.innerHTML = "";
    for (const opt of options) {
      const o = document.createElement("option");
      o.value = opt;

      const label = (opt ?? "").toString();
      const court = label.length > maxLen ? (label.slice(0, maxLen - 1) + "…") : label;

      o.textContent = court || "(vide)";
      o.title = label;

      if (opt === valeur) o.selected = true;
      select.appendChild(o);
    }
  };

  // Copie simple d’objet (pour pas modifier l’original)
  CN.app.util.copier = function (obj) {
    return JSON.parse(JSON.stringify(obj || {}));
  };

  // Vérifie que toutes les clés demandées existent dans un mapping
  CN.app.util.mappingComplet = function (m, keys) {
    return keys.every(k => (m && m[k]));
  };

  // Fusionne un mapping existant avec un mapping par défaut
  // - n’écrase pas avec null/""
  // - refuse une colonne qui n’existe pas dans les en-têtes
  CN.app.util.fusionMapping = function (defaut, existant, entetes) {
    const out = { ...(defaut || {}) };
    const src = existant || {};
    for (const [k, v] of Object.entries(src)) {
      if (!v) continue;
      if (k === "delimiteur") { out[k] = v; continue; }
      if (entetes && !entetes.includes(v)) continue;
      out[k] = v;
    }
    return out;
  };

  // Contexte “actuel” de la modal (type, en-têtes, mapping en cours…)
  let modalCtx = null;

  // Modal PIX - options avancées

  CN.app.modal.detruirePixAdvancedUI = function () {
    const advPanel = document.getElementById("pixAdvPanel");
    if (advPanel) advPanel.remove();

    const advRow = document.getElementById("pixAdvRow");
    if (advRow) advRow.remove();

    if (modalCtx) modalCtx.pixUI = null;
  };

  // Met “Options avancées” dans la modal PIX
  CN.app.modal.installerPixAdvancedUI = function () {
    if (!modalCtx || modalCtx.type !== "pix") return;

    if (document.getElementById("pixAdvRow") && document.getElementById("pixAdvPanel")) {
      const selProg = document.getElementById("pixSelProg");
      const selShare = document.getElementById("pixSelShare");
      modalCtx.pixUI = { selProg, selShare };
      return;
    }

    const grid = CN.el.mapRow1?.parentElement; // .grille-2
    const actionRow = CN.el.btnModalSave?.parentElement; // .ligne boutons
    if (!grid || !actionRow) return;

    const panel = document.createElement("div");
    panel.id = "pixAdvPanel";
    panel.className = "pix-adv-panel bloc-cache";

    const advGrid = document.createElement("div");
    advGrid.className = "grille-2";

    const rowProg = document.createElement("label");
    rowProg.className = "champ";
    rowProg.innerHTML = `
      <span class="champ-titre">Colonne % progression</span>
      <select id="pixSelProg"></select>
    `;

    const rowShare = document.createElement("label");
    rowShare.className = "champ";
    rowShare.innerHTML = `
      <span class="champ-titre">Colonne Partage (O/N)</span>
      <select id="pixSelShare"></select>
    `;

    advGrid.appendChild(rowProg);
    advGrid.appendChild(rowShare);
    panel.appendChild(advGrid);

    // Bouton “Options avancées”
    const advRow = document.createElement("div");
    advRow.id = "pixAdvRow";
    advRow.className = "modal-adv-row";

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn-advanced";
    btn.id = "btnPixAdv";
    btn.innerHTML = `Options avancées <span class="chev">▾</span>`;

    advRow.appendChild(btn);

    // Insertion : panel => bouton => zone des actions
    actionRow.parentElement.insertBefore(advRow, actionRow);
    actionRow.parentElement.insertBefore(panel, advRow);

    // Références (pour remplir les selects)
    const selProg = panel.querySelector("#pixSelProg");
    const selShare = panel.querySelector("#pixSelShare");
    modalCtx.pixUI = { selProg, selShare };

    // Ouvrir / fermer le panel
    btn.addEventListener("click", () => {
      const visible = panel.classList.contains("bloc-cache");
      CN.ui.afficherBloc(panel, visible);
      btn.innerHTML = visible
        ? `Masquer les options avancées <span class="chev">▴</span>`
        : `Options avancées <span class="chev">▾</span>`;
    });
  };

  // Affiche la version “PIX” de la modal
  CN.app.modal.rendreVueModalPix = function () {
    if (!modalCtx || modalCtx.type !== "pix") return;

    CN.el.modalHint.textContent =
      "Veuillez sélectionner les colonnes correspondant aux champs PIX.";

    // Champs principaux (toujours visibles)
    CN.ui.afficherBloc(CN.el.mapRow1, true);
    CN.ui.afficherBloc(CN.el.mapRow2, true);
    CN.ui.afficherBloc(CN.el.mapRow3, true);
    CN.ui.afficherBloc(CN.el.mapRow4, true);

    CN.el.mapLbl1.textContent = "Colonne N° étudiant";
    CN.el.mapLbl2.textContent = "Colonne NOM";
    CN.el.mapLbl3.textContent = "Colonne PRÉNOM";
    CN.el.mapLbl4.textContent = "Colonne Score (0→1)";

    CN.app.util.remplirSelect(CN.el.mapSel1, modalCtx.entetes, modalCtx.mapping.colId || "");
    CN.app.util.remplirSelect(CN.el.mapSel2, modalCtx.entetes, modalCtx.mapping.colNom || "");
    CN.app.util.remplirSelect(CN.el.mapSel3, modalCtx.entetes, modalCtx.mapping.colPrenom || "");
    CN.app.util.remplirSelect(CN.el.mapSel4, modalCtx.entetes, modalCtx.mapping.colScore || "");

    // Options avancées (dépliant)
    CN.app.modal.installerPixAdvancedUI();
    if (modalCtx.pixUI?.selProg && modalCtx.pixUI?.selShare) {
      CN.app.util.remplirSelect(modalCtx.pixUI.selProg, modalCtx.entetes, modalCtx.mapping.colProg || "");
      CN.app.util.remplirSelect(modalCtx.pixUI.selShare, modalCtx.entetes, modalCtx.mapping.colShare || "");
    }
  };

  // Avant d’enregistrer : recopie ce que l’utilisateur a choisi dans modalCtx.mapping
  CN.app.modal.syncModalToMappingAvantSave = function () {
    if (!modalCtx) return;

    // Cas général (PEGASE / PRES / RD)
    if (modalCtx.type !== "pix") {
      modalCtx.mapping[modalCtx.keys[0]] = CN.el.mapSel1.value;
      modalCtx.mapping[modalCtx.keys[1]] = CN.el.mapSel2.value;
      modalCtx.mapping[modalCtx.keys[2]] = CN.el.mapSel3.value;
      modalCtx.mapping[modalCtx.keys[3]] = CN.el.mapSel4.value;
      return;
    }

    // Cas PIX : 4 champs principaux
    modalCtx.mapping.colId = CN.el.mapSel1.value;
    modalCtx.mapping.colNom = CN.el.mapSel2.value;
    modalCtx.mapping.colPrenom = CN.el.mapSel3.value;
    modalCtx.mapping.colScore = CN.el.mapSel4.value;

    // Cas PIX : options avancées
    const selProg = document.getElementById("pixSelProg");
    const selShare = document.getElementById("pixSelShare");
    if (selProg) modalCtx.mapping.colProg = selProg.value;
    if (selShare) modalCtx.mapping.colShare = selShare.value;
  };

  // Modal de mapping (PEGASE / PIX / Présences / RD)
  CN.app.modal.ouvrirModalMapping = async function (type) {
    const fPeg = CN.el.fichierPegase.files[0] || null;
    const fPix = CN.el.fichierPix.files[0] || null;
    const fRD = CN.el.fichierRD.files[0] || null;
    const fPres = Array.from(CN.el.fichiersPresences.files || []);

    let entetes = [];
    let delim = ";";

    // Si on change de modal, on enlève l’UI avancée PIX
    CN.app.modal.detruirePixAdvancedUI();

    // PEGASE
    if (type === "pegase") {
      if (!fPeg) return CN.ui.ajouterMessage("warn", "Veuillez d'abord sélectionner le fichier PEGASE.");
      const r = await CN.imports.lireEntetesCSV(fPeg);
      entetes = r.entetes; delim = r.delim;
      CN.etat.entetesPegase = entetes;
      CN.etat.mappingPegase.delimiteur = delim;

      const def = CN.imports.proposerMappingPegase(entetes);
      const current = CN.app.util.fusionMapping(def, CN.etat.mappingPegase, entetes);

      modalCtx = {
        type,
        entetes,
        labels: ["Colonne N° étudiant", "Colonne NOM", "Colonne PRÉNOM", "Colonne NOTE à remplir"],
        keys: ["colId", "colNom", "colPrenom", "colNote"],
        mapping: CN.app.util.copier(current),
        hint: "Veuillez sélectionner les colonnes correspondant aux champs PEGASE."
      };
    }

    // RD
    if (type === "rd") {
      if (!fRD) return CN.ui.ajouterMessage("warn", "Veuillez d'abord sélectionner le fichier Recherche documentaire.");
      const r = await CN.imports.lireEntetesCSV(fRD);
      entetes = r.entetes; delim = r.delim;
      CN.etat.entetesRD = entetes;

      const def = CN.imports.proposerMappingRD(entetes);
      const current = CN.app.util.fusionMapping(def, CN.etat.mappingRD, entetes);

      modalCtx = {
        type,
        entetes,
        labels: ["Colonne N° étudiant", "Colonne NOM", "Colonne PRÉNOM", "Colonne NOTE (/20)"],
        keys: ["colId", "colNom", "colPrenom", "colNote"],
        mapping: CN.app.util.copier(current),
        hint: "Veuillez sélectionner les colonnes correspondant aux champs Recherche documentaire."
      };
    }

    // PIX
    if (type === "pix") {
      if (!fPix) return CN.ui.ajouterMessage("warn", "Veuillez d'abord sélectionner le fichier PIX.");
      const r = await CN.imports.lireEntetesCSV(fPix);
      entetes = r.entetes; delim = r.delim;
      CN.etat.entetesPix = entetes;

      const def = CN.imports.proposerMappingPIX(entetes);
      const current = CN.app.util.fusionMapping(def, CN.etat.mappingPix, entetes);

      modalCtx = {
        type,
        entetes,
        mapping: CN.app.util.copier(current),
        pixUI: null
      };
    }

    // Présences
    if (type === "pres") {
      if (!fPres.length) return CN.ui.ajouterMessage("warn", "Veuillez d'abord sélectionner au moins un fichier de présences.");
      const r = await CN.imports.lireEntetesCSV(fPres[0]);
      entetes = r.entetes; delim = r.delim;
      CN.etat.entetesPres = entetes;

      const def = CN.imports.proposerMappingPres(entetes);
      const current = CN.app.util.fusionMapping(def, CN.etat.mappingPres, entetes);

      modalCtx = {
        type,
        entetes,
        labels: ["Colonne N° étudiant", "Colonne NOM", "Colonne PRÉNOM", "Colonne Score /5"],
        keys: ["colId", "colNom", "colPrenom", "colScore5"],
        mapping: CN.app.util.copier(current),
        hint: "Veuillez sélectionner les colonnes correspondant aux champs Présences."
      };
    }

    // Titre de la modal
    CN.el.modalTitle.textContent =
      type === "pegase" ? "Paramétrage PEGASE" :
        type === "pix" ? "Paramétrage PIX" :
          type === "pres" ? "Paramétrage Présences" :
            "Paramétrage Recherche documentaire";

    // Par défaut : on affiche 4 lignes
    CN.ui.afficherBloc(CN.el.mapRow1, true);
    CN.ui.afficherBloc(CN.el.mapRow2, true);
    CN.ui.afficherBloc(CN.el.mapRow3, true);
    CN.ui.afficherBloc(CN.el.mapRow4, true);

    // PIX : écran spécifique (avec options avancées)
    if (type === "pix") {
      CN.app.modal.rendreVueModalPix();
    } else {
      // PEGASE / PRES / RD : on remplit selon labels/keys
      CN.el.modalHint.textContent = modalCtx.hint;

      CN.el.mapLbl1.textContent = modalCtx.labels[0];
      CN.el.mapLbl2.textContent = modalCtx.labels[1];
      CN.el.mapLbl3.textContent = modalCtx.labels[2];
      CN.el.mapLbl4.textContent = modalCtx.labels[3];

      CN.app.util.remplirSelect(CN.el.mapSel1, entetes, modalCtx.mapping[modalCtx.keys[0]] || "");
      CN.app.util.remplirSelect(CN.el.mapSel2, entetes, modalCtx.mapping[modalCtx.keys[1]] || "");
      CN.app.util.remplirSelect(CN.el.mapSel3, entetes, modalCtx.mapping[modalCtx.keys[2]] || "");
      CN.app.util.remplirSelect(CN.el.mapSel4, entetes, modalCtx.mapping[modalCtx.keys[3]] || "");
    }

    // Afficher la modal
    CN.ui.afficherBloc(CN.el.modalOverlay, true);
  };

  // Ferme la modal
  CN.app.modal.fermerModalMapping = function () {
    CN.app.modal.detruirePixAdvancedUI();
    modalCtx = null;
    CN.ui.afficherBloc(CN.el.modalOverlay, false);
  };

  // Enregistre le mapping choisi, puis relance un recalcul si PEGASE est déjà chargé
  CN.app.modal.enregistrerModalMapping = async function () {
    if (!modalCtx) return;

    // Récupère ce que l’utilisateur a sélectionné dans la modal
    CN.app.modal.syncModalToMappingAvantSave();

    // Mise à jour des mappings dans CN.etat
    if (modalCtx.type === "pegase") {
      CN.etat.mappingPegase.colId = modalCtx.mapping.colId;
      CN.etat.mappingPegase.colNom = modalCtx.mapping.colNom;
      CN.etat.mappingPegase.colPrenom = modalCtx.mapping.colPrenom;
      CN.etat.mappingPegase.colNote = modalCtx.mapping.colNote;
    }

    if (modalCtx.type === "rd") {
      CN.etat.mappingRD.colId = modalCtx.mapping.colId;
      CN.etat.mappingRD.colNom = modalCtx.mapping.colNom;
      CN.etat.mappingRD.colPrenom = modalCtx.mapping.colPrenom;
      CN.etat.mappingRD.colNote = modalCtx.mapping.colNote;
    }

    if (modalCtx.type === "pix") {
      CN.etat.mappingPix.colId = modalCtx.mapping.colId;
      CN.etat.mappingPix.colNom = modalCtx.mapping.colNom;
      CN.etat.mappingPix.colPrenom = modalCtx.mapping.colPrenom;
      CN.etat.mappingPix.colScore = modalCtx.mapping.colScore;

      CN.etat.mappingPix.colProg = modalCtx.mapping.colProg;
      CN.etat.mappingPix.colShare = modalCtx.mapping.colShare;
    }

    if (modalCtx.type === "pres") {
      CN.etat.mappingPres.colId = modalCtx.mapping.colId;
      CN.etat.mappingPres.colNom = modalCtx.mapping.colNom;
      CN.etat.mappingPres.colPrenom = modalCtx.mapping.colPrenom;
      CN.etat.mappingPres.colScore5 = modalCtx.mapping.colScore5;
    }

    const typeSauve = modalCtx.type;
    CN.app.modal.fermerModalMapping();

    if (CN.etat.pegase || CN.etat.pix || CN.etat.pres || CN.etat.rdRaw || CN.etat.rd) {
      try {
        await CN.app.pipeline.reimporterSiBesoin(typeSauve);
        await CN.app.pipeline.recalculer();
        CN.ui.ajouterMessage("ok", "Paramétrage enregistré et recalcul effectué.");
      } catch (e) {
        CN.ui.ajouterMessage("danger", "Erreur après enregistrement du paramétrage : " + e.message);
        console.error(e);
      }
    } else {
      CN.ui.ajouterMessage("info", "Paramétrage enregistré. Veuillez cliquer sur « Analyser ».");
    }
  };

  // Config

  CN.app.config.calcConfigFromUI = function () {
    const usePix = !!CN.el.usePix.checked;
    const usePres = !!CN.el.usePres.checked;
    const useRD = !!CN.el.useRD.checked;

    let ptsPix = CN.data.toNombreFR(CN.el.ptsPix.value);
    let ptsPres = CN.data.toNombreFR(CN.el.ptsPres.value);
    let ptsRD = CN.data.toNombreFR(CN.el.ptsRD.value);

    if (!Number.isFinite(ptsPix)) ptsPix = 0;
    if (!Number.isFinite(ptsPres)) ptsPres = 0;
    if (!Number.isFinite(ptsRD)) ptsRD = 0;

    return { usePix, usePres, useRD, ptsPix, ptsPres, ptsRD };
  };

  CN.app.config.nbComposantesSelectionnees = function (cfg) {
    return [cfg.usePix, cfg.usePres, cfg.useRD].filter(Boolean).length;
  };

  // Applique les règles :
  // - total = 20
  // - si 1 composante => elle prend 20
  // - si plusieurs => chaque pondération > 0
  // - affiche/masque les blocs PIX / Présences / RD
  CN.app.config.appliquerReglesConfig = function () {
    const cfg = CN.app.config.calcConfigFromUI();
    const nb = CN.app.config.nbComposantesSelectionnees(cfg);

    const stepPix = Number(CN.el.ptsPix.step) || 0.5;
    const stepPres = Number(CN.el.ptsPres.step) || 0.5;
    const stepRD = Number(CN.el.ptsRD.step) || 0.5;

    CN.el.ptsPix.disabled = !cfg.usePix;
    CN.el.ptsPres.disabled = !cfg.usePres;
    CN.el.ptsRD.disabled = !cfg.useRD;

    if (!cfg.usePix) CN.el.ptsPix.value = "0";
    if (!cfg.usePres) CN.el.ptsPres.value = "0";
    if (!cfg.useRD) CN.el.ptsRD.value = "0";

    if (nb === 1) {
      if (cfg.usePix) { CN.el.ptsPix.value = "20"; CN.el.ptsPix.disabled = true; }
      if (cfg.usePres) { CN.el.ptsPres.value = "20"; CN.el.ptsPres.disabled = true; }
      if (cfg.useRD) { CN.el.ptsRD.value = "20"; CN.el.ptsRD.disabled = true; }
    } else {
      function forcerMinSiCoche(input, estCoche, minStep) {
        input.min = estCoche ? String(minStep) : "0";
        if (!estCoche) return;

        let v = CN.data.toNombreFR(input.value);
        if (!Number.isFinite(v)) v = 0;
        if (v <= 0) input.value = String(minStep);
      }
      forcerMinSiCoche(CN.el.ptsPix, cfg.usePix, stepPix);
      forcerMinSiCoche(CN.el.ptsPres, cfg.usePres, stepPres);
      forcerMinSiCoche(CN.el.ptsRD, cfg.useRD, stepRD);
    }

    const finalCfg = CN.app.config.calcConfigFromUI();

    // Mise en page des imports : 1 / 2 / 3 composantes cochées
    const nbFinal = CN.app.config.nbComposantesSelectionnees(finalCfg);
    const grid = document.getElementById("importsGrid");
    if (grid) grid.dataset.comps = String(nbFinal);

    // Affichage du total
    const sum = CN.data.arrondi2(finalCfg.ptsPix + finalCfg.ptsPres + finalCfg.ptsRD);
    CN.el.sumPoints.textContent = sum.toFixed(2).replace(".", ",");

    const totalBox = document.getElementById("totalPointsDisplay");
    if (totalBox) totalBox.classList.toggle("bad-total", Math.abs(sum - 20) > 1e-9);

    // Affichage des blocs selon les cases cochées
    CN.ui.afficherBloc(CN.el.blocPix, finalCfg.usePix);
    CN.ui.afficherBloc(CN.el.blocPresences, finalCfg.usePres);
    CN.ui.afficherBloc(CN.el.blocRD, finalCfg.useRD);

    // Contrôles d’erreur
    const erreurs = [];
    if (nb === 0) erreurs.push("Vous devez sélectionner au moins une composante.");
    if (nb >= 2) {
      const bad =
        (finalCfg.usePix && finalCfg.ptsPix <= 0) ||
        (finalCfg.usePres && finalCfg.ptsPres <= 0) ||
        (finalCfg.useRD && finalCfg.ptsRD <= 0);

      if (bad) {
        erreurs.push("Lorsque plusieurs composantes sont cochées, chacune doit avoir une pondération > 0. Si vous souhaitez attribuer 0 point à une composante, veuillez la décocher.");
      }
    }
    if (nb !== 1 && Math.abs(sum - 20) > 1e-9) erreurs.push("La somme des points doit être égale à 20.");

    if (erreurs.length) {
      CN.el.configError.textContent = erreurs.join(" ");
      CN.ui.afficherBloc(CN.el.configError, true);
      CN.el.btnAnalyser.disabled = true;
    } else {
      CN.ui.afficherBloc(CN.el.configError, false);
      CN.el.btnAnalyser.disabled = false;
      CN.etat.config = finalCfg;
    }

    // Si une composante est décochée, on vide son fichier
    if (!finalCfg.usePix) { CN.el.fichierPix.value = ""; CN.ui.setDZText("pix", []); }
    if (!finalCfg.usePres) { CN.el.fichiersPresences.value = ""; CN.ui.setDZText("pres", []); }
    if (!finalCfg.useRD) { CN.el.fichierRD.value = ""; CN.ui.setDZText("rd", []); }

    CN.app.dropzones.majBoutonsConfig();
    CN.app.dropzones.majStatusPills();
  };

  // Dropzones + statuts

  CN.app.dropzones.majBoutonsConfig = function () {
    CN.el.btnCfgPegase.disabled = !(CN.el.fichierPegase.files && CN.el.fichierPegase.files.length);
    CN.el.btnCfgPix.disabled = !(CN.el.fichierPix.files && CN.el.fichierPix.files.length);
    CN.el.btnCfgRD.disabled = !(CN.el.fichierRD.files && CN.el.fichierRD.files.length);
    CN.el.btnCfgPres.disabled = !(CN.el.fichiersPresences.files && CN.el.fichiersPresences.files.length);
  };

  // Met à jour Importé/En attente sur une carte
  CN.app.dropzones.setStatusPill = function (blocEl, isLoaded) {
    if (!blocEl) return;
    const pill = blocEl.querySelector(".status-pill");
    if (!pill) return;

    pill.textContent = isLoaded ? "Importé" : "En attente";
    pill.classList.toggle("loaded", !!isLoaded);
  };

  CN.app.dropzones.majStatusPills = function () {
    const blocPegase = document.getElementById("blocPegase"); // pas dans CN.el
    CN.app.dropzones.setStatusPill(blocPegase, !!(CN.el.fichierPegase.files && CN.el.fichierPegase.files.length));

    CN.app.dropzones.setStatusPill(CN.el.blocPix, !!(CN.el.fichierPix.files && CN.el.fichierPix.files.length));
    CN.app.dropzones.setStatusPill(CN.el.blocPresences, !!(CN.el.fichiersPresences.files && CN.el.fichiersPresences.files.length));
    CN.app.dropzones.setStatusPill(CN.el.blocRD, !!(CN.el.fichierRD.files && CN.el.fichierRD.files.length));
  };

  // Gère click + drag&drop pour toutes les zones .dropzone
  CN.app.dropzones.bindDropzones = function () {
    document.querySelectorAll(".dropzone").forEach((dz) => {
      const inputId = dz.getAttribute("data-input");
      const input = document.getElementById(inputId);
      if (!input) return;

      dz.addEventListener("click", () => input.click());

      dz.addEventListener("dragover", (e) => {
        e.preventDefault();
        dz.classList.add("dragover");
      });

      dz.addEventListener("dragleave", () => dz.classList.remove("dragover"));

      dz.addEventListener("drop", (e) => {
        e.preventDefault();
        dz.classList.remove("dragover");

        const files = Array.from(e.dataTransfer?.files || []);
        if (!files.length) return;

        const dt = new DataTransfer();
        if (input.multiple) files.forEach((f) => dt.items.add(f));
        else dt.items.add(files[0]);

        input.files = dt.files;
        input.dispatchEvent(new Event("change"));
      });
    });

    // À chaque changement de fichier : on met à jour le texte + les boutons + le statut
    CN.el.fichierPegase.addEventListener("change", () => { CN.ui.setDZText("peg", CN.el.fichierPegase.files); CN.app.dropzones.majBoutonsConfig(); CN.app.dropzones.majStatusPills(); });
    CN.el.fichierPix.addEventListener("change", () => { CN.ui.setDZText("pix", CN.el.fichierPix.files); CN.app.dropzones.majBoutonsConfig(); CN.app.dropzones.majStatusPills(); });
    CN.el.fichiersPresences.addEventListener("change", () => { CN.ui.setDZText("pres", CN.el.fichiersPresences.files); CN.app.dropzones.majBoutonsConfig(); CN.app.dropzones.majStatusPills(); });
    CN.el.fichierRD.addEventListener("change", () => { CN.ui.setDZText("rd", CN.el.fichierRD.files); CN.app.dropzones.majBoutonsConfig(); CN.app.dropzones.majStatusPills(); });
  };

  // Analyse + recalcul

  // Recharge uniquement la source concernée après un changement de mapping (PIX / PRES / RD)
  CN.app.pipeline.reimporterSiBesoin = async function (type) {
    const cfg = CN.etat.config;

    if (type === "pix" && cfg.usePix) {
      const fPix = CN.el.fichierPix.files[0] || null;
      if (fPix) CN.etat.pix = await CN.imports.chargerPIX(fPix, cfg.ptsPix, CN.etat.mappingPix);
    }

    if (type === "pres" && cfg.usePres) {
      const files = Array.from(CN.el.fichiersPresences.files || []);
      if (files.length) CN.etat.pres = await CN.imports.chargerPresences(files, CN.etat.mappingPres);
    }

    if (type === "rd" && cfg.useRD) {
      const fRD = CN.el.fichierRD.files[0] || null;
      if (fRD) {
        CN.etat.rdRaw = await CN.imports.chargerRD_brut(fRD);
        CN.etat.rd = CN.imports.construireRD_depuisRaw(CN.etat.rdRaw, CN.etat.mappingRD, cfg.ptsRD, fRD.name);
      }
    }
  };

  // Analyser => imports => calcul => affichage
  CN.app.pipeline.executerAnalyse = async function () {
    CN.ui.viderMessages();
    CN.ui.afficherBloc(CN.el.zoneResultats, false);

    CN.app.config.appliquerReglesConfig();
    const cfg = CN.etat.config;

    const fPeg = CN.el.fichierPegase.files[0] || null;
    const fPix = cfg.usePix ? (CN.el.fichierPix.files[0] || null) : null;
    const fPres = cfg.usePres ? Array.from(CN.el.fichiersPresences.files || []) : [];
    const fRD = cfg.useRD ? (CN.el.fichierRD.files[0] || null) : null;

    const avecPegase = !!fPeg;
    CN.etat.modeSansPegase = !avecPegase;

    if (!avecPegase) {
      CN.ui.ajouterMessage(
        "info",
        "Analyse sans fichier PEGASE : le calcul sera effectué uniquement à partir des composants importés. Le CSV \"PEGASE rempli\" ne sera pas généré."
      );
    }

    // Avertissements si composante cochée sans fichier
    if (cfg.usePix && !fPix) CN.ui.ajouterMessage("warn", "PIX sélectionné mais aucun fichier importé - contribution PIX = 0.");
    if (cfg.usePres && !fPres.length) CN.ui.ajouterMessage("warn", "Présences sélectionné mais aucun fichier importé - contribution Présences = 0.");
    if (cfg.useRD && !fRD) CN.ui.ajouterMessage("warn", "Recherche documentaire sélectionné mais aucun fichier importé - contribution Recherche documentaire = 0.");

    // PEGASE
    if (avecPegase) {
      CN.ui.ajouterMessage("info", "Lecture PEGASE…");
      CN.etat.pegase = await CN.imports.chargerPEGASE(fPeg);
      CN.etat.entetesPegase = CN.etat.pegase.entetes;

      // On s’assure que le mapping PEGASE est cohérent avec les entêtes
      const defPeg = CN.imports.proposerMappingPegase(CN.etat.pegase.entetes);
      const mergedPeg = CN.app.util.fusionMapping(defPeg, CN.etat.mappingPegase, CN.etat.pegase.entetes);
      CN.etat.mappingPegase.colId = mergedPeg.colId;
      CN.etat.mappingPegase.colNom = mergedPeg.colNom;
      CN.etat.mappingPegase.colPrenom = mergedPeg.colPrenom;
      CN.etat.mappingPegase.colNote = mergedPeg.colNote;
      CN.etat.mappingPegase.delimiteur = CN.etat.pegase.delim || ";";
    } else {
      CN.etat.pegase = null;
      CN.etat.entetesPegase = null;
      CN.etat.pegaseRempli = null;
      CN.etat.mappingPegase.delimiteur = ";";
    }

    // PIX
    if (cfg.usePix && fPix) {
      CN.ui.ajouterMessage("info", "Lecture PIX…");
      CN.etat.pix = await CN.imports.chargerPIX(fPix, cfg.ptsPix, CN.etat.mappingPix);
      CN.etat.entetesPix = CN.etat.pix.entetes;
    } else {
      CN.etat.pix = { parEtudiant: new Map(), invalides: [], totalLignes: 0, nbValides: 0 };
    }

    // Présences
    if (cfg.usePres && fPres.length) {
      CN.ui.ajouterMessage("info", "Lecture Présences…");
      CN.etat.pres = await CN.imports.chargerPresences(fPres, CN.etat.mappingPres);
    } else {
      CN.etat.pres = { map: new Map(), invalides: [], fichiersCount: 0 };
    }

    // RD
    if (cfg.useRD && fRD) {
      CN.ui.ajouterMessage("info", "Lecture Recherche documentaire…");
      CN.etat.rdRaw = await CN.imports.chargerRD_brut(fRD);
      CN.etat.entetesRD = CN.etat.rdRaw.entetes;

      // Mise à jour mapping RD selon les entêtes
      const defRD = CN.imports.proposerMappingRD(CN.etat.rdRaw.entetes);
      const mergedRD = CN.app.util.fusionMapping(defRD, CN.etat.mappingRD, CN.etat.rdRaw.entetes);
      CN.etat.mappingRD.colId = mergedRD.colId;
      CN.etat.mappingRD.colNom = mergedRD.colNom;
      CN.etat.mappingRD.colPrenom = mergedRD.colPrenom;
      CN.etat.mappingRD.colNote = mergedRD.colNote;

      // Si mapping incomplet : on ouvre la modal et on stoppe l’analyse
      if (!CN.app.util.mappingComplet(CN.etat.mappingRD, ["colId", "colNom", "colPrenom", "colNote"])) {
        CN.ui.ajouterMessage("warn", "Recherche documentaire : paramétrage requis - veuillez sélectionner les colonnes, puis cliquer sur « Enregistrer ».");
        await CN.app.modal.ouvrirModalMapping("rd");
        return;
      }

      CN.etat.rd = CN.imports.construireRD_depuisRaw(CN.etat.rdRaw, CN.etat.mappingRD, cfg.ptsRD, fRD.name);
    } else {
      CN.etat.rdRaw = null;
      CN.etat.rd = { ok: true, map: new Map(), invalides: [], totalLignes: 0, nbValides: 0 };
    }

    // Dernière étape : calcul + affichage
    await CN.app.pipeline.recalculer();
  };

  // Recalcule les notes/anomalies + met à jour le résumé et les tableaux
  CN.app.pipeline.recalculer = async function () {
    const cfg = CN.etat.config;
    const avecPegase = !!CN.etat.pegase;

    if (avecPegase) {
      // PEGASE doit être correctement paramétré
      if (!CN.app.util.mappingComplet(CN.etat.mappingPegase, ["colId", "colNom", "colPrenom", "colNote"])) {
        CN.ui.ajouterMessage("warn", "PEGASE : paramétrage requis.");
        await CN.app.modal.ouvrirModalMapping("pegase");
        return;
      }
    }

    const build = CN.traitement.construireNotes(cfg, CN.etat.pix, CN.etat.pres, CN.etat.rd);

    const remplissage = avecPegase
      ? CN.traitement.remplirPegase(CN.etat.pegase, CN.etat.mappingPegase, build.notes)
      : { lignesOut: [], nbEcrits: 0, nbIgnores: 0, nbABI: 0, inconnus: [] };

    const ana = CN.traitement.analyserAnomalies(
      cfg,
      avecPegase ? CN.etat.pegase : null,
      avecPegase ? CN.etat.mappingPegase : null,
      CN.etat.pix,
      CN.etat.pres,
      CN.etat.rd,
      build
    );

    // Sauvegarde dans l’état global
    CN.etat.notes = build.notes;
    CN.etat.pegaseRempli = remplissage;
    CN.etat.anomalies = ana.anomalies;
    CN.etat.anomaliesParId = ana.anomaliesParId;

    // Construction de l’aperçu (table principale)
    CN.etat.apercu = CN.affichage.rendreTableApercu(CN.etat.pegase, CN.etat.mappingPegase, CN.etat.notes, CN.etat.anomaliesParId, cfg);

    // Résumé
    CN.el.resume.innerHTML = "";
    const stats = {
      avecPegase,
      pegaseLignes: avecPegase ? CN.etat.pegase.lignes.length : 0,
      pixValides: CN.etat.pix.nbValides,
      pixInvalides: CN.etat.pix.invalides.length,
      presFichiers: CN.etat.pres.fichiersCount,
      presInvalides: CN.etat.pres.invalides.length,
      rdValides: CN.etat.rd?.nbValides ?? 0,
      rdInvalides: CN.etat.rd?.invalides?.length ?? 0,
      nbEcrits: remplissage.nbEcrits,
      nbIgnores: remplissage.nbIgnores,
      nbABI: remplissage.nbABI,
      nbAnomalies: CN.etat.anomalies.length,
    };
    CN.el.resume.appendChild(CN.affichage.construireResume(stats, cfg));

    // Tableau aperçu
    CN.affichage.remplirTableHTML(
      CN.el.tableApercuHead,
      CN.el.tableApercuBody,
      CN.etat.apercu.entetes,
      CN.etat.apercu.lignes,
      CN.etat.apercu.labels
    );

    // Tableau anomalies (aperçu)
    const listAno = CN.etat.anomalies || [];

    const showSuggestionAno = listAno.some(a =>
      ((a?.propositionId ?? "").toString().trim() !== "")
    );

    const entAno = [
      "Type",
      "Source",
      "Fichier",
      "N° étudiant",
      "Nom",
      "Prénom",
      ...(showSuggestionAno ? ["Suggestion N° étudiant"] : []),
      "Détail"
    ];

    const lignesAno = listAno.map(a => {
      const row = {
        "Type": a?.type || "",
        "Source": a?.source || "",
        "Fichier": a?.fichier || "",
        "N° étudiant": a?.idTrouve || "",
        "Nom": a?.nom || "",
        "Prénom": a?.prenom || "",
        "Détail": a?.message || "",
      };

      if (showSuggestionAno) {
        row["Suggestion N° étudiant"] = a?.propositionId || "";
      }

      return row;
    });

    CN.affichage.remplirTableHTML(
      CN.el.tableAnomaliesHead,
      CN.el.tableAnomaliesBody,
      entAno,
      lignesAno
    );

    // Affiche la zone résultats
    CN.ui.afficherBloc(CN.el.zoneResultats, true);

    // Filtre/recherche : on recalcule l’affichage du tableau aperçu
    CN.el.recherche.oninput = () => CN.affichage.filtrerApercu(CN.etat.apercu);
    CN.el.filtreAnomalies.onchange = () => CN.affichage.filtrerApercu(CN.etat.apercu);

    // Active les boutons d’export
    CN.ui.afficherBloc(CN.el.btnExportPegase, avecPegase);
    CN.el.btnExportPegase.disabled = !avecPegase;
    CN.el.btnExportAnomalies.disabled = false;
    CN.el.btnExportCalcul.disabled = false;
  };

  // Exports CSV

  // Construit l’horodatage pour les noms de fichiers
  // Format : AAAA-MM-JJ_11h12
  CN.app.exports.getHorodatageNomFichier = function () {
    const now = new Date();

    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mi = String(now.getMinutes()).padStart(2, "0");

    return `${yyyy}-${mm}-${dd}_${hh}h${mi}`;
  };

  // Génère le CSV des anomalies (colonne “Suggestion” seulement si utile)
  CN.app.exports.construireAnomaliesCSV = function (anomalies, delim) {
    const list = anomalies || [];

    const showSuggestion = (anomalies || []).some(a =>
      a?.type === "NUM_ETUDIANT_INVALIDE" &&
      ((a?.propositionId ?? "").toString().trim() !== "")
    );

    const showFichier = list.some(a =>
      ((a?.fichier ?? "").toString().trim() !== "")
    );

    const entetes = [
      "Type",
      "Source",
      ...(showFichier ? ["Fichier"] : []),
      "N° étudiant",
      "Nom",
      "Prénom",
      ...(showSuggestion ? ["Suggestion N° étudiant"] : []),
      "Détail"
    ];

    const lignes = (anomalies || []).map(a => {
      const row = {
        "Type": a?.type || "",
        "Source": a?.source || "",
        "N° étudiant": a?.idTrouve || "",
        "Nom": a?.nom || "",
        "Prénom": a?.prenom || "",
        "Détail": a?.message || "",
      };

      if (showFichier) row["Fichier"] = a?.fichier || "";

      if (showSuggestion) {
        row["Suggestion N° étudiant"] =
          a?.type === "NUM_ETUDIANT_INVALIDE" ? (a?.propositionId || "") : "";
      }

      return row;
    });

    return CN.csv.genererCSV(entetes, lignes, delim);
  };

  // Export du fichier PEGASE rempli (on reprend les mêmes entêtes que l’import)
  CN.app.exports.exporterPegaseRempli = function () {
    const entetes = CN.etat.pegase.entetes;
    const lignes = CN.etat.pegaseRempli.lignesOut;
    const csv = CN.csv.genererCSV(entetes, lignes, CN.etat.mappingPegase.delimiteur || ";");

    const horodatage = CN.app.exports.getHorodatageNomFichier();
    CN.csv.telechargerTexte(`PEGASE_rempli_${horodatage}.csv`, csv);
  };

  // Construit le CSV “calcul” (notes PIX / présences / RD / finale)
  CN.app.exports.construireCalculCSV = function (apercu, mappingPegase, config, delim) {
    const ptsPix = Number.isFinite(config?.ptsPix) ? config.ptsPix : 0;
    const ptsPres = Number.isFinite(config?.ptsPres) ? config.ptsPres : 0;
    const ptsRD = Number.isFinite(config?.ptsRD) ? config.ptsRD : 0;

    const colId = mappingPegase?.colId || "N° étudiant";
    const colNom = mappingPegase?.colNom || "Nom";
    const colPrenom = mappingPegase?.colPrenom || "Prénom";

    const entetes = [
      "N° étudiant",
      "Nom",
      "Prénom",
    ];

    if (config.usePix) entetes.push(`Note PIX (/${ptsPix})`);
    if (config.usePres) entetes.push(`Note présences (/${ptsPres})`);
    if (config.useRD) entetes.push(`Note RD (/${ptsRD})`);
    entetes.push("Note finale (/20)");

    function fmt(v) {
      const s = (v ?? "").toString().trim();
      if (!s) return "";
      return (delim === ";") ? s.replace(".", ",") : s;
    }

    const lignes = (apercu?.lignes || []).map(r => {
      const out = {
        "N° étudiant": (r[colId] ?? "").toString(),
        "Nom": (r[colNom] ?? "").toString(),
        "Prénom": (r[colPrenom] ?? "").toString(),
      };

      if (config.usePix) out[`Note PIX (/${ptsPix})`] = fmt(r["NOTE_PIX"]);
      if (config.usePres) out[`Note présences (/${ptsPres})`] = fmt(r["NOTE_PRESENCES"]);
      if (config.useRD) out[`Note RD (/${ptsRD})`] = fmt(r["NOTE_RD"]);
      out["Note finale (/20)"] = fmt(r["NOTE_FINALE_20"]);

      return out;
    });

    return CN.csv.genererCSV(entetes, lignes, delim);
  };

  CN.app.exports.exporterCalculCSV = function () {
    if (!CN.etat?.apercu) {
      CN.ui.ajouterMessage("warn", "Aucun résultat à exporter. Cliquez d'abord sur « Analyser ».");
      return;
    }
    const delim = CN.etat.mappingPegase?.delimiteur || ";";
    const csv = CN.app.exports.construireCalculCSV(
      CN.etat.apercu,
      CN.etat.mappingPegase || null,
      CN.etat.config,
      delim
    );

    const horodatage = CN.app.exports.getHorodatageNomFichier();
    CN.csv.telechargerTexte(`calcul_notes_${horodatage}.csv`, csv);
  };

  // Export anomalies
  CN.app.exports.libelleTypeAnomalie = function (type) {
    const map = {
      NUM_ETUDIANT_INVALIDE: "Numéro étudiant invalide",
      INCONNU_PEGASE: "Étudiant absent du fichier PEGASE",
      COMPOSANTE_MANQUANTE: "Composante manquante",
    };
    return map[type] || type || "(Type inconnu)";
  };

  // Liste des types d’anomalies présents dans les résultats
  CN.app.exports.getTypesAnomalies = function () {
    const anomalies = CN.etat.anomalies || [];
    return Array.from(new Set(anomalies.map(a => a.type).filter(Boolean))).sort();
  };

  CN.app.exports.fermerMenuExportAnomalies = function () {
    const menu = document.getElementById("exportAnoMenu");
    if (menu) menu.remove();

    if (window.__exportAnoOnDocClick) {
      document.removeEventListener("mousedown", window.__exportAnoOnDocClick, true);
      window.__exportAnoOnDocClick = null;
    }
    if (window.__exportAnoOnKeyDown) {
      document.removeEventListener("keydown", window.__exportAnoOnKeyDown, true);
      window.__exportAnoOnKeyDown = null;
    }
  };

  // Lance l’export (tout ou un type précis)
  CN.app.exports.executerExportAnomalies = function (typeUniqueOuNull) {
    const anomalies = CN.etat.anomalies || [];
    if (!anomalies.length) {
      CN.ui.ajouterMessage("info", "Aucune anomalie à exporter.", 2500);
      return;
    }

    const horodatage = CN.app.exports.getHorodatageNomFichier();

    let selection = anomalies;
    let nomFichier = `anomalies_${horodatage}.csv`;

    if (typeUniqueOuNull) {
      selection = anomalies.filter(a => a.type === typeUniqueOuNull);
      nomFichier = `anomalies_${typeUniqueOuNull}_${horodatage}.csv`;
    }

    if (!selection.length) {
      CN.ui.ajouterMessage("info", "Aucune anomalie ne correspond à la sélection.", 2500);
      return;
    }

    const csv = CN.app.exports.construireAnomaliesCSV(selection, CN.etat.mappingPegase.delimiteur || ";");
    CN.csv.telechargerTexte(nomFichier, csv);
  };

  // Construit et affiche le menu sous le bouton
  CN.app.exports.ouvrirMenuExportAnomalies = function (btn) {
    CN.app.exports.fermerMenuExportAnomalies();

    const typesDispo = CN.app.exports.getTypesAnomalies();
    if (!typesDispo.length) {
      CN.ui.ajouterMessage("info", "Aucune anomalie à exporter.", 2500);
      return;
    }

    const rect = btn.getBoundingClientRect();

    const menu = document.createElement("div");
    menu.id = "exportAnoMenu";

    // Style du menu
    menu.style.position = "absolute";
    menu.style.zIndex = "2000";
    menu.style.top = `${rect.bottom + window.scrollY + 8}px`;
    menu.style.left = `${rect.left + window.scrollX}px`;
    menu.style.minWidth = `${Math.max(260, Math.round(rect.width))}px`;
    menu.style.maxWidth = "420px";
    menu.style.background = "#ffffff";
    menu.style.border = "1px solid #d8e0ee";
    menu.style.borderRadius = "12px";
    menu.style.boxShadow = "0 10px 30px rgba(17,24,39,.10)";
    menu.style.padding = "6px";
    menu.style.userSelect = "none";

    const menuWidth = 420;
    const leftMax = window.innerWidth - 12 - menuWidth;
    if (rect.left > leftMax) {
      menu.style.left = `${Math.max(12, window.innerWidth - 12 - menuWidth)}px`;
    }

    // Génère un item cliquable
    function itemHTML(label, dataAttr, value, isPrimary = false) {
      return `
        <div
          ${dataAttr}="${value}"
          style="
            padding:10px 12px;
            border-radius:10px;
            cursor:pointer;
            font-weight:${isPrimary ? 900 : 800};
            font-size:13px;
            color:#111827;
            line-height:1.25;
            white-space:normal;
          "
          onmouseover="this.style.background='${isPrimary ? "#eff6ff" : "#f5f9ff"}'"
          onmouseout="this.style.background='transparent'"
        >
          ${label}
        </div>
      `;
    }

    let html = "";
    html += itemHTML("Toutes les anomalies", "data-action", "all", true);
    html += `<div style="height:1px;background:#eef2f8;margin:6px 6px;"></div>`;

    for (const t of typesDispo) {
      html += itemHTML(CN.app.exports.libelleTypeAnomalie(t), "data-type", t, false);
    }

    menu.innerHTML = html;
    document.body.appendChild(menu);

    // Click sur un item
    menu.addEventListener("click", (e) => {
      const target = e.target.closest("[data-action],[data-type]");
      if (!target) return;

      const action = target.getAttribute("data-action");
      const type = target.getAttribute("data-type");

      CN.app.exports.fermerMenuExportAnomalies();

      if (action === "all") {
        CN.app.exports.executerExportAnomalies(null);
        return;
      }
      if (type) CN.app.exports.executerExportAnomalies(type);
    });

    // Fermer si clic extérieur
    window.__exportAnoOnDocClick = (e) => {
      const m = document.getElementById("exportAnoMenu");
      if (!m) return;
      if (m.contains(e.target) || btn.contains(e.target)) return;
      CN.app.exports.fermerMenuExportAnomalies();
    };
    document.addEventListener("mousedown", window.__exportAnoOnDocClick, true);

    // ESC ferme
    window.__exportAnoOnKeyDown = (e) => {
      if (e.key === "Escape") CN.app.exports.fermerMenuExportAnomalies();
    };
    document.addEventListener("keydown", window.__exportAnoOnKeyDown, true);
  };

  // Bouton anomalies : ouvre/ferme le menu
  CN.app.exports.exporterAnomalies = function () {
    const menu = document.getElementById("exportAnoMenu");
    if (menu) {
      CN.app.exports.fermerMenuExportAnomalies();
      return;
    }
    CN.app.exports.ouvrirMenuExportAnomalies(CN.el.btnExportAnomalies);
  };

  // Main (reset, bind, init)

  // Réinitialisation (remet l’état à zéro)
  CN.app.main.reinitialiser = function () {
    CN.etat.pegase = null;
    CN.etat.pix = null;
    CN.etat.pres = null;
    CN.etat.rdRaw = null;
    CN.etat.rd = null;

    CN.etat.mappingPegase = { colId: null, colNom: null, colPrenom: null, colNote: null, delimiteur: ";" };
    CN.etat.mappingRD = { colId: null, colNom: null, colPrenom: null, colNote: null };

    // reset PIX
    CN.etat.mappingPix = { colId: null, colNom: null, colPrenom: null, colScore: null, colProg: null, colShare: null };

    CN.etat.mappingPres = { colId: null, colNom: null, colPrenom: null, colScore5: null };

    CN.etat.entetesPegase = null;
    CN.etat.entetesPix = null;
    CN.etat.entetesPres = null;
    CN.etat.entetesRD = null;

    CN.etat.notes = null;
    CN.etat.pegaseRempli = null;
    CN.etat.anomalies = null;
    CN.etat.anomaliesParId = null;
    CN.etat.apercu = null;
    CN.etat.modeSansPegase = false;

    // Reset inputs fichiers
    CN.el.fichierPegase.value = "";
    CN.el.fichierPix.value = "";
    CN.el.fichiersPresences.value = "";
    CN.el.fichierRD.value = "";

    // Reset textes des dropzones
    CN.ui.setDZText("peg", []);
    CN.ui.setDZText("pix", []);
    CN.ui.setDZText("pres", []);
    CN.ui.setDZText("rd", []);

    // Reset UI
    CN.app.dropzones.majStatusPills();
    CN.ui.viderMessages();
    CN.ui.afficherBloc(CN.el.zoneResultats, false);
    CN.app.modal.fermerModalMapping();

    CN.el.recherche.value = "";
    CN.el.filtreAnomalies.value = "tous";

    CN.ui.ajouterMessage("info", "Réinitialisation effectuée.", 2500);
    CN.app.dropzones.majBoutonsConfig();

    CN.ui.afficherBloc(CN.el.btnExportPegase, true);
    CN.el.btnExportPegase.disabled = true;
    CN.el.btnExportAnomalies.disabled = true;
    CN.el.btnExportCalcul.disabled = true;
  };

  // Alerte Safari (compatibilité fichiers)
  CN.app.main.detectSafari = function () {
    const ua = navigator.userAgent || "";
    const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
    CN.ui.afficherBloc(CN.el.safariWarning, isSafari);
  };

  // Gestion des événements (clics / input / clavier)
  CN.app.main.bind = function () {
    // Changement config
    [CN.el.usePix, CN.el.usePres, CN.el.useRD, CN.el.ptsPix, CN.el.ptsPres, CN.el.ptsRD].forEach(x => {
      x.addEventListener("change", CN.app.config.appliquerReglesConfig);
      x.addEventListener("input", CN.app.config.appliquerReglesConfig);
    });

    // Bouton “Analyser”
    CN.el.btnAnalyser.addEventListener("click", () => {
      CN.app.pipeline.executerAnalyse().catch(e => {
        CN.ui.ajouterMessage("danger", "Erreur : " + e.message);
        console.error(e);
      });
    });

    // Boutons principaux
    CN.el.btnReinitialiser.addEventListener("click", CN.app.main.reinitialiser);
    CN.el.btnExportPegase.addEventListener("click", CN.app.exports.exporterPegaseRempli);
    CN.el.btnExportAnomalies.addEventListener("click", CN.app.exports.exporterAnomalies);
    CN.el.btnExportCalcul.addEventListener("click", CN.app.exports.exporterCalculCSV);

    // Boutons mapping
    CN.el.btnCfgPegase.addEventListener("click", () => CN.app.modal.ouvrirModalMapping("pegase").catch(e => CN.ui.ajouterMessage("danger", e.message)));
    CN.el.btnCfgPix.addEventListener("click", () => CN.app.modal.ouvrirModalMapping("pix").catch(e => CN.ui.ajouterMessage("danger", e.message)));
    CN.el.btnCfgPres.addEventListener("click", () => CN.app.modal.ouvrirModalMapping("pres").catch(e => CN.ui.ajouterMessage("danger", e.message)));
    CN.el.btnCfgRD.addEventListener("click", () => CN.app.modal.ouvrirModalMapping("rd").catch(e => CN.ui.ajouterMessage("danger", e.message)));

    // Modal : fermer / annuler / enregistrer
    CN.el.btnModalClose.addEventListener("click", CN.app.modal.fermerModalMapping);
    CN.el.btnModalCancel.addEventListener("click", CN.app.modal.fermerModalMapping);
    CN.el.btnModalSave.addEventListener("click", () => CN.app.modal.enregistrerModalMapping());

    // Clic sur le fond => ferme
    CN.el.modalOverlay.addEventListener("click", (e) => {
      if (e.target === CN.el.modalOverlay) CN.app.modal.fermerModalMapping();
    });

    // Touche ESC => ferme la modal si elle est ouverte
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;

      if (CN.el.aboutOverlay && !CN.el.aboutOverlay.classList.contains("bloc-cache")) {
        CN.ui.afficherBloc(CN.el.aboutOverlay, false);
        return;
      }

      if (CN.el.modalOverlay && !CN.el.modalOverlay.classList.contains("bloc-cache")) {
        CN.app.modal.fermerModalMapping();
      }
    });
  };

  // A propos
  function ouvrirAbout() {
    if (!CN.el.aboutBody) return;

    CN.el.aboutBody.innerHTML =
      `<b>Outil de traitement automatise des notes</b><br/>
     Version : <b>${CN.meta?.version || ""}</b><br/>
     Auteur : <b>${(CN.meta?.prenom || "") + " " + (CN.meta?.nom || "")}</b>`;

    CN.ui.afficherBloc(CN.el.aboutOverlay, true);
  }

  function fermerAbout() {
    CN.ui.afficherBloc(CN.el.aboutOverlay, false);
  }

  if (CN.el.btnAbout) CN.el.btnAbout.addEventListener("click", ouvrirAbout);
  if (CN.el.btnAboutClose) CN.el.btnAboutClose.addEventListener("click", fermerAbout);
  if (CN.el.btnAboutOk) CN.el.btnAboutOk.addEventListener("click", fermerAbout);

  if (CN.el.aboutOverlay) {
    CN.el.aboutOverlay.addEventListener("click", (e) => {
      if (e.target === CN.el.aboutOverlay) fermerAbout();
    });
  }

  // Initialisation au chargement de la page
  CN.app.main.init = function () {
    // Par défaut : pas d’export tant qu’on n’a pas analysé
    CN.el.btnExportPegase.disabled = true;
    CN.el.btnExportAnomalies.disabled = true;
    CN.el.btnExportCalcul.disabled = true;
    CN.el.btnExportAnomalies.textContent = "Exporter CSV anomalies ▾";

    // Textes de dropzones
    CN.ui.setDZText("peg", []);
    CN.ui.setDZText("pix", []);
    CN.ui.setDZText("pres", []);
    CN.ui.setDZText("rd", []);

    // Mise en place
    CN.app.dropzones.majStatusPills();
    CN.app.dropzones.bindDropzones();
    CN.app.main.detectSafari();
    CN.app.main.bind();
    CN.app.config.appliquerReglesConfig();
    CN.app.dropzones.majBoutonsConfig();

    CN.ui.afficherBloc(CN.el.btnExportPegase, true);
  };

  CN.app.main.init();
})();