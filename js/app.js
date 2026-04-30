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
  CN.app.presets = CN.app.presets || {};
  CN.app.main = CN.app.main || {};

  // Sécurise les stockages supplémentaires utilisés par ce fichier
  CN.etat.fichiersComposantes = CN.etat.fichiersComposantes || {};
  CN.etat.fichiersComposantesClassiques = CN.etat.fichiersComposantesClassiques || {};

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

  CN.app.util.escapeHTML = function (value) {
    return (value ?? "").toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  };

  CN.app.util.formaterNombreCourt = function (valeur, fallback = "20") {
    const n = CN.data.toNombreFR(valeur);
    if (!Number.isFinite(n)) return fallback;
    return n.toFixed(3).replace(/\.?0+$/, "").replace(".", ",");
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

  CN.app.util.aDesFichiersSelectionnes = function () {
    const aPegase = !!(CN.el.fichierPegase?.files && CN.el.fichierPegase.files.length);

    const aClassique = Object.values(CN.etat.fichiersComposantesClassiques || {})
      .some(list => Array.isArray(list) && list.length > 0);

    const aLibre = Object.values(CN.etat.fichiersComposantes || {})
      .some(list => Array.isArray(list) && list.length > 0);

    return aPegase || aClassique || aLibre;
  };

  // Pondération : points / coefficients

  CN.app.config.normaliserModePonderation = function (mode) {
    return mode === "coefficients" ? "coefficients" : "points";
  };

  CN.app.config.syncModePonderationDepuisUI = function () {
    const mode = CN.app.config.normaliserModePonderation(
      CN.el.modePonderation?.value || CN.etat.config?.modePonderation || "points"
    );

    CN.etat.config.modePonderation = mode;

    if (CN.el.modePonderation) {
      CN.el.modePonderation.value = mode;
    }

    return mode;
  };

  CN.app.config.estModeCoefficients = function () {
    return CN.app.config.normaliserModePonderation(
      CN.etat.config?.modePonderation || "points"
    ) === "coefficients";
  };

  CN.app.config.majAffichagePonderation = function () {
    const mode = CN.app.config.normaliserModePonderation(
      CN.etat.config?.modePonderation || "points"
    );

    const modeCoeff = mode === "coefficients";

    if (CN.el.modePonderation) {
      CN.el.modePonderation.value = mode;
    }

    document.querySelectorAll(".pts-max").forEach(node => {
      node.textContent = modeCoeff ? "coef." : "/20";
    });

    if (CN.el.ponderationHelp) {
      CN.el.ponderationHelp.textContent = modeCoeff
        ? "Les valeurs saisies sont des coefficients. L’application calcule automatiquement la répartition sur /20."
        : "Les valeurs saisies correspondent directement aux points attribués sur /20.";
    }
  };

  CN.app.config.ensurePonderationComposantes = function (composantes) {
    const comps = Array.isArray(composantes) ? composantes : [];

    for (const comp of comps) {
      if (!comp) continue;

      const coef = CN.data.toNombreFR(comp.coefficient);
      const poids = CN.data.toNombreFR(comp.poids);

      if (!Number.isFinite(coef) || coef <= 0) {
        comp.coefficient = Number.isFinite(poids) && poids > 0 ? poids : 1;
      }

      if (!Number.isFinite(poids)) {
        comp.poids = 0;
      }
    }
  };

  CN.app.config.formaterValeurSaisiePonderation = function (comp) {
    const modeCoeff = CN.app.config.estModeCoefficients();
    const valeur = modeCoeff ? comp?.coefficient : comp?.poids;
    const n = CN.data.toNombreFR(valeur);

    if (!Number.isFinite(n)) return "0";

    return String(n);
  };

  CN.app.config.setValeurSaisiePonderation = function (comp, valeur) {
    if (!comp) return;

    const n = CN.data.toNombreFR(valeur);
    const v = Number.isFinite(n) ? n : 0;

    if (CN.app.config.estModeCoefficients()) {
      comp.coefficient = v;
    } else {
      comp.poids = v;
    }
  };

  CN.app.config.calculerPonderationEffective = function (composantes) {
    const comps = Array.isArray(composantes) ? composantes.filter(Boolean) : [];
    const modeCoeff = CN.app.config.estModeCoefficients();

    CN.app.config.ensurePonderationComposantes(comps);

    for (const comp of comps) {
      if (!comp.actif) {
        comp.poids = 0;
      }
    }

    const actives = comps.filter(c => c && c.actif);
    const erreurs = [];

    if (actives.length === 0) {
      erreurs.push("Vous devez sélectionner au moins une composante.");
      return { actives, totalAffiche: 0, erreurs };
    }

    // Mode coefficients : on calcule automatiquement les points sur /20
    if (modeCoeff) {
      let sommeCoef = 0;

      for (const comp of actives) {
        let coef = CN.data.toNombreFR(comp.coefficient);

        if (!Number.isFinite(coef) || coef <= 0) {
          coef = 0.5;
        }

        comp.coefficient = coef;
        sommeCoef += coef;
      }

      if (actives.length === 1) {
        actives[0].poids = 20;
      } else if (sommeCoef > 0) {
        for (const comp of actives) {
          comp.poids = (comp.coefficient / sommeCoef) * 20;
        }
      }

      return { actives, totalAffiche: sommeCoef, erreurs };
    }

    // Mode points : la somme doit faire 20
    if (actives.length === 1) {
      actives[0].poids = 20;
    } else {
      for (const comp of actives) {
        let v = CN.data.toNombreFR(comp.poids);

        if (!Number.isFinite(v)) v = 0;
        if (v <= 0) v = 0.5;

        comp.poids = v;
      }
    }

    const somme = CN.data.arrondi2(
      actives.reduce((acc, c) => acc + (Number.isFinite(c.poids) ? c.poids : 0), 0)
    );

    if (actives.length >= 2) {
      const bad = actives.some(c => !Number.isFinite(c.poids) || c.poids <= 0);
      if (bad) {
        erreurs.push("Lorsque plusieurs composantes sont actives, chacune doit avoir une pondération > 0.");
      }
    }

    if (actives.length !== 1 && Math.abs(somme - 20) > 1e-9) {
      erreurs.push("La somme des points doit être égale à 20.");
    }

    return { actives, totalAffiche: somme, erreurs };
  };

  CN.app.config.afficherTotalPonderation = function (total, hasErreur) {
    const n = Number.isFinite(total) ? total : 0;
    const texte = n.toFixed(2).replace(".", ",");

    if (CN.el.sumPoints) {
      CN.el.sumPoints.textContent = texte;
    }

    if (CN.el.sumPointsLibreMirror) {
      CN.el.sumPointsLibreMirror.textContent = texte;
    }

    const totalBox = document.getElementById("totalPointsDisplay");
    if (totalBox) {
      totalBox.classList.toggle("bad-total", !!hasErreur);
    }

    const totalBoxLibre = document.getElementById("totalPointsDisplayLibre");
    if (totalBoxLibre) {
      totalBoxLibre.classList.toggle("bad-total", !!hasErreur);
    }

    CN.app.config.majAffichagePonderation();
  };

  // Mode classique dynamique

  CN.app.config.ensureModeClassiqueDynamicUI = function () {
    const box = CN.el.configClassiqueBox;
    const grid = CN.el.importsGrid;

    if (box) {
      let list = document.getElementById("classicComposantesList");
      if (!list) {
        list = document.createElement("div");
        list.id = "classicComposantesList";

        const firstExtra = box.querySelector(".config-extra");
        if (firstExtra) {
          box.insertBefore(list, firstExtra);
        } else {
          box.appendChild(list);
        }
      }

      CN.el.classicComposantesList = list;

      box.querySelectorAll(':scope > .config-item').forEach(node => {
        node.remove();
      });
    }

    if (grid) {
      let wrap = document.getElementById("classicImportsCards");
      if (!wrap) {
        wrap = document.createElement("div");
        wrap.id = "classicImportsCards";
        wrap.style.display = "contents";
        grid.appendChild(wrap);
      }

      CN.el.classicImportsCards = wrap;

      ["blocPix", "blocPresences", "blocRD"].forEach(id => {
        const node = document.getElementById(id);
        if (node) node.remove();
      });
    }
  };

  CN.app.config.getInputActifComposanteClassique = function (id) {
    return CN.el.classicComposantesList?.querySelector(
      `[data-role="classic-active"][data-comp-id="${id}"]`
    ) || null;
  };

  CN.app.config.getInputPoidsComposanteClassique = function (id) {
    return CN.el.classicComposantesList?.querySelector(
      `[data-role="classic-weight"][data-comp-id="${id}"]`
    ) || null;
  };

  CN.app.config.rendreListeComposantesClassiques = function () {
    CN.app.config.ensureModeClassiqueDynamicUI();

    if (!CN.el.classicComposantesList || CN.utils.estModeLibre()) return;

    const comps = Array.isArray(CN.etat.composantes) ? CN.etat.composantes : [];
    const nbActives = comps.filter(c => c && c.actif).length;
    const modeCoeff = CN.app.config.estModeCoefficients();

    CN.el.classicComposantesList.innerHTML = comps.map((comp) => {
      const nom = CN.app.util.escapeHTML(comp?.nom || comp?.id || "Composante");
      const valeur = CN.app.config.formaterValeurSaisiePonderation(comp);
      const checked = comp?.actif ? "checked" : "";
      const disabledPoids = (!comp?.actif || (nbActives === 1 && comp?.actif)) ? "disabled" : "";

      const min = modeCoeff ? "0.01" : "0";
      const max = modeCoeff ? "" : `max="20"`;
      const title = modeCoeff
        ? "Coefficient de la composante"
        : "Nombre de points attribués à la composante sur /20";

      return `
      <div class="config-item">
        <label class="checkbox-label" for="use_classique_${comp.id}">
          <input
            id="use_classique_${comp.id}"
            type="checkbox"
            data-role="classic-active"
            data-comp-id="${comp.id}"
            ${checked}
          />
          <span class="custom-checkbox"></span>
          <span>${nom}</span>
        </label>

        <input
          id="pts_classique_${comp.id}"
          class="input-number"
          type="number"
          min="${min}"
          ${max}
          step="0.5"
          value="${valeur}"
          title="${title}"
          data-role="classic-weight"
          data-comp-id="${comp.id}"
          ${disabledPoids}
        />
      </div>
    `;
    }).join("");
  };

  // Mode libre

  CN.app.config.sauverEtatModeLibre = function () {
    if (!CN.utils.estModeLibre()) return;
    CN.etat.composantesLibres = CN.app.util.copier(CN.etat.composantes || []);
  };

  CN.app.config.sauverEtatModeClassique = function () {
    if (CN.utils.estModeLibre()) return;
    CN.etat.composantesClassiques = CN.app.util.copier(CN.etat.composantes || []);
  };

  CN.app.config.initialiserModeClassiqueDepuisSauvegarde = function () {
    if (Array.isArray(CN.etat.composantesClassiques) && CN.etat.composantesClassiques.length) {
      CN.etat.composantes = CN.app.util.copier(CN.etat.composantesClassiques);
      return;
    }

    CN.etat.composantes = CN.utils.creerComposantesModeClassique();
    CN.etat.composantesClassiques = CN.app.util.copier(CN.etat.composantes);
  };

  CN.app.config.initialiserModeLibreDepuisClassique = function () {
    if (Array.isArray(CN.etat.composantesLibres) && CN.etat.composantesLibres.length) {
      CN.etat.composantes = CN.app.util.copier(CN.etat.composantesLibres);
      return;
    }

    CN.etat.composantes = CN.utils.creerComposantesModeLibreParDefaut();
    CN.etat.composantesLibres = CN.app.util.copier(CN.etat.composantes);
    CN.etat.compteurComposantesLibres = 2;
    CN.etat.fichiersComposantes = CN.etat.fichiersComposantes || {};
  };

  CN.app.config.normaliserComposantesModeLibre = function () {
    const comps = Array.isArray(CN.etat.composantes) ? CN.etat.composantes : [];

    for (const comp of comps) {
      if (!comp) continue;

      const doitResetMapping =
        comp.typeCalcul !== "note20" ||
        !comp.mapping ||
        !Object.prototype.hasOwnProperty.call(comp.mapping, "colNote");

      // En mode libre, toutes les composantes sont traitées par défaut comme des notes sur 20
      comp.typeCalcul = "note20";

      // On garde l’option plusieurs fichiers
      comp.multiFichiers = !!comp.multiFichiers;

      // Barème source de la note lue dans le fichier
      comp.baremeSource = CN.utils.normaliserBaremeSource(comp.baremeSource, 20);

      if (doitResetMapping) {
        comp.mapping = CN.utils.creerMappingVidePourType("note20");
      }

      if (!comp.mappingParFichier || typeof comp.mappingParFichier !== "object") {
        comp.mappingParFichier = {};
      }
    }
  };

  CN.app.config.basculerModeSaisie = function (mode) {
    const cible = mode === "libre" ? "libre" : "classique";
    if (cible === CN.etat.modeSaisie) return;

    if (cible === "libre") {
      // Avant de quitter le mode classique, on synchronise l’UI
      // puis on mémorise l’état actuel du mode classique
      if (CN.utils.estModeClassique()) {
        CN.app.config.syncComposantesDepuisUIClassique();
        CN.app.config.sauverEtatModeClassique();
      }

      CN.app.config.initialiserModeLibreDepuisClassique();
      CN.etat.modeSaisie = "libre";
      CN.app.config.normaliserComposantesModeLibre();
    } else {
      // Avant de quitter le mode libre, on mémorise son état actuel
      if (CN.utils.estModeLibre()) {
        CN.etat.composantesLibres = CN.app.util.copier(CN.etat.composantes || []);
      }

      CN.etat.modeSaisie = "classique";
      CN.app.config.initialiserModeClassiqueDepuisSauvegarde();

      CN.app.config.rendreListeComposantesClassiques();
      CN.app.dropzones.rendreImportsModeClassique();
    }

    CN.app.config.appliquerReglesConfig();
  };

  CN.app.config.majAffichageModeSaisie = function () {
    const modeLibre = CN.utils.estModeLibre();

    if (CN.el.modeClassique) CN.el.modeClassique.checked = !modeLibre;
    if (CN.el.modeLibre) CN.el.modeLibre.checked = modeLibre;

    CN.ui.afficherBloc(CN.el.configClassiqueBox, !modeLibre);
    CN.ui.afficherBloc(CN.el.configLibreBox, modeLibre);
    CN.ui.afficherBloc(CN.el.importsGrid, !modeLibre);
    CN.ui.afficherBloc(CN.el.importsFreeGrid, modeLibre);

    CN.app.config.majAffichagePonderation();
  };

  CN.app.config.ajouterComposanteLibre = function () {
    const comps = Array.isArray(CN.etat.composantes) ? CN.etat.composantes : [];

    if (comps.length >= 10) {
      CN.ui.ajouterMessage("warn", "Maximum 10 composantes en mode libre.");
      return;
    }

    CN.etat.compteurComposantesLibres = (Number(CN.etat.compteurComposantesLibres) || comps.length || 0) + 1;
    comps.push(CN.utils.creerComposanteLibre(CN.etat.compteurComposantesLibres));
    CN.etat.composantes = comps;

    CN.app.config.appliquerReglesConfig();
  };

  CN.app.config.supprimerComposanteLibre = function (compId) {
    const comps = Array.isArray(CN.etat.composantes) ? CN.etat.composantes : [];
    CN.etat.composantes = comps.filter(c => c && c.id !== compId);

    if (CN.etat.fichiersComposantes && CN.etat.fichiersComposantes[compId]) {
      delete CN.etat.fichiersComposantes[compId];
    }

    CN.app.dropzones.invaliderResultatsAnalyse();
    CN.app.config.appliquerReglesConfig();
  };

  CN.app.config.rendreListeComposantesLibres = function () {
    if (!CN.el.freeComposantesList) return;

    const comps = Array.isArray(CN.etat.composantes) ? CN.etat.composantes : [];
    const nbActives = comps.filter(c => c && c.actif).length;

    if (!comps.length) {
      CN.el.freeComposantesList.innerHTML = `<div class="free-empty">Aucune composante.</div>`;
      if (CN.el.btnAddComposante) CN.el.btnAddComposante.disabled = false;
      return;
    }

    CN.el.freeComposantesList.innerHTML = `
    <div class="free-classic-list">
      ${comps.map((comp) => {
      const nom = CN.app.util.escapeHTML(comp?.nom || "");
      const poids = CN.app.config.formaterValeurSaisiePonderation(comp);
      const modeCoeff = CN.app.config.estModeCoefficients();
      const minPonderation = modeCoeff ? "0.01" : "0";
      const maxPonderation = modeCoeff ? "" : `max="20"`;
      const titlePonderation = modeCoeff
        ? "Coefficient de la composante"
        : "Nombre de points attribués à la composante sur /20";

      return `
        <div class="free-classic-item" data-comp-id="${comp.id}">
          <div class="free-classic-main">
            <div class="free-classic-left">
              <label class="checkbox-label free-inline-check">
                <input
                  type="checkbox"
                  data-action="toggle-actif"
                  data-comp-id="${comp.id}"
                  ${comp.actif ? "checked" : ""}
                />
                <span class="custom-checkbox"></span>
              </label>

              <input
                type="text"
                class="input-text free-classic-name"
                data-action="change-nom"
                data-comp-id="${comp.id}"
                value="${nom}"
                placeholder="Nom de la composante"
              />
            </div>

            <input
              type="number"
              min="${minPonderation}"
              ${maxPonderation}
              step="0.5"
              class="input-number free-classic-weight"
              data-action="change-poids"
              data-comp-id="${comp.id}"
              value="${poids}"
              title="${titlePonderation}"
              ${(nbActives === 1 && comp.actif) ? "disabled" : ""}
            />

            <button
              type="button"
              class="btn-icone btn-gear free-classic-settings"
              title="Réglages de la composante"
              data-action="open-comp-settings"
              data-comp-id="${comp.id}"
            ></button>
          </div>

        </div>
      `;
    }).join("")}
    </div>
  `;

    if (CN.el.btnAddComposante) {
      CN.el.btnAddComposante.disabled = comps.length >= 10;
    }

    const root = CN.el.freeComposantesList;

    root.querySelectorAll('[data-action="toggle-actif"]').forEach(node => {
      node.addEventListener("change", () => {
        const comp = CN.utils.getComposanteById(node.dataset.compId);
        if (!comp) return;
        comp.actif = !!node.checked;
        CN.app.config.appliquerReglesConfig();
      });
    });

    root.querySelectorAll('[data-action="change-nom"]').forEach(node => {
      node.addEventListener("input", () => {
        const comp = CN.utils.getComposanteById(node.dataset.compId);
        if (!comp) return;
        comp.nom = node.value || "Composante";
        CN.app.config.sauverEtatModeLibre();
        CN.app.dropzones.rendreImportsModeLibre();
      });
    });

    root.querySelectorAll('[data-action="change-poids"]').forEach(node => {
      const majPoids = () => {
        const comp = CN.utils.getComposanteById(node.dataset.compId);
        if (!comp) return;

        let valeur = Number.isFinite(node.valueAsNumber)
          ? node.valueAsNumber
          : CN.data.toNombreFR(node.value);

        if (!Number.isFinite(valeur)) valeur = 0;

        CN.app.config.setValeurSaisiePonderation(comp, valeur);

        CN.app.config.appliquerReglesConfig();
      };

      node.addEventListener("input", majPoids);
      node.addEventListener("change", majPoids);
    });

    root.querySelectorAll('[data-action="open-comp-settings"]').forEach(node => {
      node.addEventListener("click", () => {
        CN.app.modal.ouvrirModalReglagesComposante(node.dataset.compId);
      });
    });
  };

  CN.app.dropzones.getTexteSelectionFichiersComposante = function (comp, files) {
    const list = Array.isArray(files) ? files : [];
    if (!list.length) return "Aucun fichier sélectionné";
    if (list.length === 1) return list[0].name;
    return `${list.length} fichier(s) sélectionné(s)`;
  };

  CN.app.dropzones.getLibelleCarteComposante = function (comp) {
    const nom = (comp?.nom || comp?.id || "Composante").toString();

    if (comp?.id === "pix") return "Fichier PIX (CSV)";
    if (comp?.id === "pres") return "Fichiers de présence (CSV)";
    if (comp?.id === "rd") return "Fichier Recherche documentaire (CSV)";

    return comp?.multiFichiers ? `Fichiers ${nom} (CSV)` : `Fichier ${nom} (CSV)`;
  };

  CN.app.dropzones.getLibelleActionImportComposante = function (comp) {
    const nom = (comp?.nom || comp?.id || "Composante").toString();

    if (comp?.id === "pix") return "Importer fichier PIX";
    if (comp?.id === "pres") return "Importer fichier(s) Présences";
    if (comp?.id === "rd") return "Importer fichier RD";

    return comp?.multiFichiers ? `Importer fichier(s) ${nom}` : `Importer fichier ${nom}`;
  };

  // Badge affiché sur la carte pour indiquer le barème source de la note
  CN.app.dropzones.getLibelleBadgeBaremeComposante = function (comp) {
    const type = (comp?.typeCalcul || "").toString().trim().toLowerCase();

    if (type === "presence") {
      return "barème /5";
    }

    if (type === "pix") {
      return "score 0→1";
    }

    const bareme = CN.app.util.formaterNombreCourt(comp?.baremeSource, "20");
    return `barème /${bareme}`;
  };

  CN.app.dropzones.invaliderResultatsAnalyse = function () {
    CN.etat.notes = null;
    CN.etat.pegaseRempli = null;
    CN.etat.anomalies = null;
    CN.etat.anomaliesParId = null;
    CN.etat.apercu = null;
    CN.etat.tableAnomaliesData = null;
    CN.etat.modeSansPegase = false;

    if (CN.el.resume) CN.el.resume.innerHTML = "";
    if (CN.el.tableApercuHead) CN.el.tableApercuHead.innerHTML = "";
    if (CN.el.tableApercuBody) CN.el.tableApercuBody.innerHTML = "";
    if (CN.el.tableAnomaliesHead) CN.el.tableAnomaliesHead.innerHTML = "";
    if (CN.el.tableAnomaliesBody) CN.el.tableAnomaliesBody.innerHTML = "";

    // Réinitialise aussi les zones de pagination des tableaux
    if (CN.el.paginationApercu) CN.el.paginationApercu.innerHTML = "";
    if (CN.el.paginationAnomalies) CN.el.paginationAnomalies.innerHTML = "";

    // Remet les tableaux paginés à la page 1
    if (CN.etat.pagination) {
      CN.etat.pagination.apercu = { page: 1, parPage: 50 };
      CN.etat.pagination.anomalies = { page: 1, parPage: 50 };
    }

    CN.ui.afficherBloc(CN.el.zoneResultats, false);
    CN.ui.afficherBloc(CN.el.btnExportPegase, true);
    CN.el.btnExportPegase.disabled = true;
    CN.el.btnExportAnomalies.disabled = true;
    CN.el.btnExportCalcul.disabled = true;
    if (CN.el.btnExportDetailCalcul) CN.el.btnExportDetailCalcul.disabled = true;
  };

  CN.app.dropzones.viderImportPegase = function () {
    if (CN.el.fichierPegase) {
      CN.el.fichierPegase.value = "";
    }

    CN.etat.pegase = null;
    CN.etat.pegaseRempli = null;
    CN.etat.entetesPegase = null;

    CN.ui.setDZText("peg", []);
    CN.app.dropzones.invaliderResultatsAnalyse();
    CN.app.dropzones.majBoutonsConfig();
    CN.app.dropzones.majStatusPills();

    CN.ui.ajouterMessage("info", "Import PEGASE vidé.", 2000);
  };

  CN.app.dropzones.viderImportComposante = function (compId, modeImport) {
    const comp = CN.utils.getComposanteById(compId);
    if (!comp) return;

    const mode = modeImport === "classique" ? "classique" : "libre";

    const storeName = mode === "classique"
      ? "fichiersComposantesClassiques"
      : "fichiersComposantes";

    CN.etat[storeName] = CN.etat[storeName] || {};
    delete CN.etat[storeName][compId];

    const inputId = mode === "classique"
      ? `inputClassicComp_${compId}`
      : `inputComp_${compId}`;

    const input = document.getElementById(inputId);
    if (input) input.value = "";

    comp.brut = null;
    comp.resultat = null;

    CN.app.dropzones.invaliderResultatsAnalyse();

    if (mode === "classique") {
      CN.app.dropzones.rendreImportsModeClassique();
    } else {
      CN.app.dropzones.rendreImportsModeLibre();
    }

    CN.app.dropzones.majBoutonsConfig();
    CN.app.dropzones.majStatusPills();

    CN.ui.ajouterMessage("info", `Import « ${comp.nom} » vidé.`, 2000);
  };

  CN.app.dropzones.rendreImportsModeClassique = function () {
    CN.app.config.ensureModeClassiqueDynamicUI();

    if (!CN.el.classicImportsCards || CN.utils.estModeLibre()) return;

    const composantesActives = (CN.etat.composantes || []).filter(c => c && c.actif);
    CN.el.importsGrid.dataset.comps = String(composantesActives.length);

    CN.el.classicImportsCards.innerHTML = composantesActives.map((comp) => {
      const files = CN.app.pipeline.getFilesComposante(comp);
      const titre = CN.app.util.escapeHTML(CN.app.dropzones.getLibelleCarteComposante(comp));
      const action = CN.app.util.escapeHTML(CN.app.dropzones.getLibelleActionImportComposante(comp));
      const sousTexte = CN.app.util.escapeHTML(
        CN.app.dropzones.getTexteSelectionFichiersComposante(comp, files)
      );
      const nom = CN.app.util.escapeHTML(comp?.nom || comp?.id || "Composante");

      return `
        <section class="file-card" data-comp-card="${comp.id}">
          <div class="file-head">
            <div class="file-title-row">
              <h3 class="file-title">${titre}</h3>

              <div class="file-head-actions">
                <button
                  type="button"
                  class="btn-icone btn-gear"
                  title="Paramétrage colonnes (${nom})"
                  data-action="cfg-comp"
                  data-comp-id="${comp.id}"
                ></button>

                <button
                  type="button"
                  class="btn-icone btn-clear-card"
                  title="Vider cette carte"
                  data-action="clear-comp"
                  data-comp-id="${comp.id}"
                  data-comp-mode="classique"
                  ${files.length ? "" : "disabled"}
                >
                  Vider
                </button>
              </div>
            </div>

            <span class="status-pill status-wait">En attente</span>
          </div>

          <div class="dropzone dz-card" data-input="inputClassicComp_${comp.id}">
            <div class="dz-title">${action}</div>
            <div class="dz-sub" data-classic-dz-name="${comp.id}">${sousTexte}</div>
          </div>

          <input
            id="inputClassicComp_${comp.id}"
            class="input-file-hidden"
            type="file"
            accept=".csv,text/csv"
            data-comp-id="${comp.id}"
            data-comp-mode="classique"
            ${comp.multiFichiers ? "multiple" : ""}
          />
        </section>
      `;
    }).join("");

    CN.app.dropzones.bindDropzones();
    CN.app.dropzones.majBoutonsConfig();
    CN.app.dropzones.majStatusPills();
  };

  CN.app.dropzones.rendreImportsModeLibre = function () {
    if (!CN.el.importsFreeGrid) return;
    if (!CN.utils.estModeLibre()) return;

    const composantesActives = (CN.etat.composantes || []).filter(c => c && c.actif);
    const nbFinal = composantesActives.length;
    CN.el.importsFreeGrid.dataset.comps = String(nbFinal);

    const cards = composantesActives.map((comp) => {
      const files = CN.app.pipeline.getFilesComposante(comp);
      const titre = CN.app.util.escapeHTML(CN.app.dropzones.getLibelleCarteComposante(comp));
      const action = CN.app.util.escapeHTML(CN.app.dropzones.getLibelleActionImportComposante(comp));
      const sousTexte = CN.app.util.escapeHTML(CN.app.dropzones.getTexteSelectionFichiersComposante(comp, files));
      const nom = CN.app.util.escapeHTML(comp.nom || comp.id || "Composante");
      const multiTxt = CN.app.util.escapeHTML(comp.multiFichiers ? "multi-fichiers" : "1 fichier");
      const baremeTxt = CN.app.util.escapeHTML(
        CN.app.dropzones.getLibelleBadgeBaremeComposante(comp)
      );

      return `
      <section class="file-card" data-comp-card="${comp.id}">
        <div class="file-head">
          <div class="file-title-row">
            <h3 class="file-title">${titre}</h3>

            <div class="file-head-actions">
              <button
                type="button"
                class="btn-icone btn-gear"
                title="Paramétrage colonnes (${nom})"
                data-action="cfg-comp"
                data-comp-id="${comp.id}"
              ></button>

              <button
                type="button"
                class="btn-icone btn-clear-card"
                title="Vider cette carte"
                data-action="clear-comp"
                data-comp-id="${comp.id}"
                data-comp-mode="libre"
                ${files.length ? "" : "disabled"}
              >
                Vider
              </button>
            </div>
          </div>

          <span class="status-pill status-wait">En attente</span>
        </div>

        <div class="free-card-badges">
          <span class="free-badge">${multiTxt}</span>
          <span class="free-badge">${baremeTxt}</span>
        </div>

        <div class="dropzone dz-card" data-input="inputComp_${comp.id}">
          <div class="dz-title">${action}</div>
          <div class="dz-sub" data-free-dz-name="${comp.id}">${sousTexte}</div>
        </div>

        <input
          id="inputComp_${comp.id}"
          class="input-file-hidden"
          type="file"
          accept=".csv,text/csv"
          data-comp-id="${comp.id}"
          data-comp-mode="libre"
          ${comp.multiFichiers ? "multiple" : ""}
        />
      </section>
    `;
    }).join("");

    CN.el.importsFreeGrid.innerHTML = `
      <section class="file-card file-pegase" id="blocPegaseFree">
        <div class="file-head">
          <div class="file-title-row">
            <h3 class="file-title">Fichier modèle PEGASE (CSV)</h3>

            <div class="file-head-actions">
              <button id="btnCfgPegaseFree" type="button" class="btn-icone btn-gear" title="Paramétrage colonnes (PEGASE)"></button>

              <button
                id="btnClearPegaseFree"
                type="button"
                class="btn-icone btn-clear-card"
                title="Vider cette carte"
                ${CN.el.fichierPegase.files?.length ? "" : "disabled"}
              >
                Vider
              </button>
            </div>
          </div>

          <span class="status-pill status-wait">En attente</span>
        </div>

        <div class="dropzone dz-card" data-input="fichierPegase">
          <div class="dz-title">Importer fichier PEGASE</div>
          <div class="dz-sub" data-dz-kind="peg">${CN.app.util.escapeHTML(
      CN.el.fichierPegase.files?.length ? CN.el.fichierPegase.files[0].name : "Aucun fichier sélectionné"
    )}</div>
        </div>
      </section>

      ${cards}
    `;

    const btnCfgPegaseFree = document.getElementById("btnCfgPegaseFree");
    if (btnCfgPegaseFree) {
      btnCfgPegaseFree.addEventListener("click", () => {
        CN.app.modal.ouvrirModalMappingPegase().catch(e => CN.ui.ajouterMessage("danger", e.message));
      });
    }

    const btnClearPegaseFree = document.getElementById("btnClearPegaseFree");
    if (btnClearPegaseFree) {
      btnClearPegaseFree.addEventListener("click", () => {
        CN.app.dropzones.viderImportPegase();
      });
    }

    CN.el.importsFreeGrid.querySelectorAll('[data-action="cfg-comp"]').forEach(btn => {
      btn.addEventListener("click", () => {
        CN.app.modal.ouvrirModalMappingComposante(btn.dataset.compId).catch(e => {
          CN.ui.ajouterMessage("danger", e.message);
        });
      });
    });

    CN.el.importsFreeGrid.querySelectorAll('[data-action="clear-comp"]').forEach(btn => {
      btn.addEventListener("click", () => {
        CN.app.dropzones.viderImportComposante(
          btn.dataset.compId,
          btn.dataset.compMode
        );
      });
    });

    CN.app.dropzones.bindDropzones();
    CN.app.dropzones.majBoutonsConfig();
    CN.app.dropzones.majStatusPills();
  };

  // Contexte “actuel” de la modal (type, en-têtes, mapping en cours…)
  let modalCtx = null;
  let compSettingsCtx = null;

  // Modal paramètres avancés (arrondi + mode PEGASE)

  CN.app.modal.majPreviewParamCalcul = function () {
    if (!CN.el.arrondiPreview) return;

    const arrondiActif = (CN.el.paramArrondiActif?.value || "oui") === "oui";

    if (CN.el.paramArrondiMethode) {
      CN.el.paramArrondiMethode.disabled = !arrondiActif;
    }

    if (CN.el.paramArrondiPrecision) {
      CN.el.paramArrondiPrecision.disabled = !arrondiActif;
    }

    const cfgPreview = {
      arrondiActif,
      arrondiMethode: CN.el.paramArrondiMethode?.value || "classique",
      arrondiPrecision: CN.el.paramArrondiPrecision?.value || "centieme"
    };

    const ex = CN.data.formaterNoteSelonConfig(12.341, cfgPreview, ",");

    CN.el.arrondiPreview.innerHTML = arrondiActif
      ? `<b>Exemple :</b> 12,341 devient <b>${ex}</b>`
      : `<b>Exemple :</b> 12,341 reste <b>${ex}</b> (note brute)`;
  };

  CN.app.modal.ouvrirParamCalcul = function () {
    if (CN.el.paramModeRemplissage) {
      CN.el.paramModeRemplissage.value = CN.etat.config.modeRemplissage || "ne_rien_ecraser";
    }
    if (CN.el.paramArrondiActif) {
      CN.el.paramArrondiActif.value = CN.etat.config.arrondiActif === false ? "non" : "oui";
    }
    if (CN.el.paramArrondiMethode) {
      CN.el.paramArrondiMethode.value = CN.etat.config.arrondiMethode || "classique";
    }
    if (CN.el.paramArrondiPrecision) {
      CN.el.paramArrondiPrecision.value = CN.etat.config.arrondiPrecision || "centieme";
    }

    CN.app.modal.majPreviewParamCalcul();
    CN.ui.afficherBloc(CN.el.settingsOverlay, true);
  };

  CN.app.modal.fermerParamCalcul = function () {
    CN.ui.afficherBloc(CN.el.settingsOverlay, false);
  };

  CN.app.modal.enregistrerParamCalcul = async function () {
    CN.etat.config.modeRemplissage = (CN.el.paramModeRemplissage?.value || "ne_rien_ecraser").toString();
    CN.etat.config.arrondiActif = (CN.el.paramArrondiActif?.value || "oui") === "oui";
    CN.etat.config.arrondiMethode = (CN.el.paramArrondiMethode?.value || "classique").toString();
    CN.etat.config.arrondiPrecision = (CN.el.paramArrondiPrecision?.value || "centieme").toString();

    CN.app.modal.fermerParamCalcul();
    CN.app.config.appliquerReglesConfig();

    const doitRelancerAnalyse = CN.etat.analyseDejaLancee === true;

    if (doitRelancerAnalyse) {
      try {
        await CN.app.pipeline.executerAnalyse();
        CN.ui.ajouterMessage("ok", "Paramètres avancés enregistrés et analyse relancée.");
      } catch (e) {
        CN.ui.ajouterMessage("danger", "Erreur après enregistrement des paramètres avancés : " + e.message);
        console.error(e);
      }
    } else {
      CN.ui.ajouterMessage("info", "Paramètres avancés enregistrés.");
    }
  };

  // Modal réglages composante (mode libre)

  CN.app.modal.ouvrirModalReglagesComposante = function (compId) {
    if (!CN.utils.estModeLibre()) return;

    const comp = CN.utils.getComposanteById(compId);
    if (!comp) return;

    compSettingsCtx = { composanteId: comp.id };

    if (CN.el.compSettingsTitle) {
      CN.el.compSettingsTitle.textContent = `Réglages de ${comp.nom || "la composante"}`;
    }

    if (CN.el.compSettingsHint) {
      CN.el.compSettingsHint.textContent = `Configurez les options d’import et de calcul pour cette composante.`;
    }

    if (CN.el.compSettingsMulti) {
      CN.el.compSettingsMulti.checked = !!comp.multiFichiers;
    }

    if (CN.el.compSettingsBaremeSource) {
      CN.el.compSettingsBaremeSource.value = Number.isFinite(comp?.baremeSource)
        ? String(comp.baremeSource)
        : "20";
    }

    if (CN.el.compSettingsBaremeWrap) {
      CN.ui.afficherBloc(CN.el.compSettingsBaremeWrap, comp.typeCalcul === "note20");
    }

    CN.ui.afficherBloc(CN.el.compSettingsOverlay, true);
  };

  CN.app.modal.fermerModalReglagesComposante = function () {
    compSettingsCtx = null;
    CN.ui.afficherBloc(CN.el.compSettingsOverlay, false);
  };

  CN.app.modal.enregistrerModalReglagesComposante = function () {
    if (!compSettingsCtx) return;

    const comp = CN.utils.getComposanteById(compSettingsCtx.composanteId);
    if (!comp) {
      CN.app.modal.fermerModalReglagesComposante();
      return;
    }

    comp.multiFichiers = !!CN.el.compSettingsMulti?.checked;

    if (comp.typeCalcul === "note20" && CN.el.compSettingsBaremeSource) {
      let bareme = Number.isFinite(CN.el.compSettingsBaremeSource.valueAsNumber)
        ? CN.el.compSettingsBaremeSource.valueAsNumber
        : CN.data.toNombreFR(CN.el.compSettingsBaremeSource.value);

      if (!Number.isFinite(bareme) || bareme <= 0) {
        bareme = 20;
      }

      comp.baremeSource = bareme;
    }

    if (!comp.multiFichiers && CN.etat.fichiersComposantes?.[comp.id]) {
      CN.etat.fichiersComposantes[comp.id] = CN.etat.fichiersComposantes[comp.id].slice(0, 1);
    }

    CN.app.dropzones.invaliderResultatsAnalyse();
    CN.app.config.sauverEtatModeLibre();
    CN.app.config.rendreListeComposantesLibres();
    CN.app.dropzones.rendreImportsModeLibre();
    CN.app.dropzones.majBoutonsConfig();
    CN.app.dropzones.majStatusPills();

    CN.app.modal.fermerModalReglagesComposante();
    CN.ui.ajouterMessage("info", "Réglages de la composante enregistrés.", 2000);
  };

  CN.app.modal.supprimerDepuisModalReglagesComposante = function () {
    if (!compSettingsCtx) return;

    const compId = compSettingsCtx.composanteId;

    CN.app.modal.fermerModalReglagesComposante();
    CN.app.config.supprimerComposanteLibre(compId);
  };

  // Modal de mapping par composante

  CN.app.modal.detruirePixAdvancedUI = function () {
    const advPanel = document.getElementById("pixAdvPanel");
    if (advPanel) advPanel.remove();

    const advRow = document.getElementById("pixAdvRow");
    if (advRow) advRow.remove();

    if (modalCtx) modalCtx.pixUI = null;
  };

  CN.app.modal.detruirePresMultiUI = function () {
    const row = document.getElementById("presFileRow");
    if (row) row.remove();
  };

  CN.app.modal.detruireNote20MultiUI = function () {
    const row = document.getElementById("note20FileRow");
    if (row) row.remove();
  };

  CN.app.modal.getLibelleColonneNote20 = function (baremeSource) {
    return `Colonne NOTE (/${CN.app.util.formaterNombreCourt(baremeSource, "20")})`;
  };

  CN.app.modal.sauverMappingNote20Courant = function () {
    if (!CN.app.modal.estModalComposanteType("note20")) return;
    if (!modalCtx.note20CurrentKey) return;
    if (!Array.isArray(modalCtx.note20Files) || modalCtx.note20Files.length <= 1) return;

    modalCtx.mappingParFichier = modalCtx.mappingParFichier || {};

    modalCtx.mappingParFichier[modalCtx.note20CurrentKey] = {
      colId: CN.el.mapSel1.value || null,
      colNom: CN.el.mapSel2.value || null,
      colPrenom: CN.el.mapSel3.value || null,
      colNote: CN.el.mapSel4.value || null,
    };
  };

  CN.app.modal.installerNote20MultiUI = function () {
    if (!CN.app.modal.estModalComposanteType("note20")) return;
    if (!Array.isArray(modalCtx.note20Files) || modalCtx.note20Files.length <= 1) return;

    let row = document.getElementById("note20FileRow");
    if (row) return;

    const grid = CN.el.mapRow1?.parentElement;
    if (!grid || !grid.parentElement) return;

    row = document.createElement("label");
    row.id = "note20FileRow";
    row.className = "champ";
    row.style.marginBottom = "12px";

    row.innerHTML = `
    <span class="champ-titre">Fichier de la composante</span>
    <select id="note20FileSelect"></select>
  `;

    grid.parentElement.insertBefore(row, grid);

    const select = row.querySelector("#note20FileSelect");

    for (const f of modalCtx.note20Files) {
      const opt = document.createElement("option");
      opt.value = f.key;
      opt.textContent = f.name;
      select.appendChild(opt);
    }

    select.value = modalCtx.note20CurrentKey || modalCtx.note20Files[0].key;

    select.addEventListener("change", () => {
      CN.app.modal.sauverMappingNote20Courant();
      modalCtx.note20CurrentKey = select.value;
      CN.app.modal.rendreVueModalNote20();
    });
  };

  CN.app.modal.rendreVueModalNote20 = function () {
    if (!CN.app.modal.estModalComposanteType("note20")) return;

    // Cas multi-fichiers
    if (Array.isArray(modalCtx.note20Files) && modalCtx.note20Files.length > 1) {
      CN.app.modal.installerNote20MultiUI();

      let fichierCourant = modalCtx.note20Files.find(f => f.key === modalCtx.note20CurrentKey);
      if (!fichierCourant) {
        fichierCourant = modalCtx.note20Files[0];
        modalCtx.note20CurrentKey = fichierCourant.key;
      }

      const mappingCourant = modalCtx.mappingParFichier?.[fichierCourant.key] || {};

      const fileSelect = document.getElementById("note20FileSelect");
      if (fileSelect) fileSelect.value = fichierCourant.key;

      CN.el.modalHint.textContent =
        `Veuillez sélectionner les colonnes correspondant aux champs de « ${modalCtx.composanteNom} » pour le fichier « ${fichierCourant.name} ».`;

      CN.ui.afficherBloc(CN.el.mapRow1, true);
      CN.ui.afficherBloc(CN.el.mapRow2, true);
      CN.ui.afficherBloc(CN.el.mapRow3, true);
      CN.ui.afficherBloc(CN.el.mapRow4, true);

      CN.el.mapLbl1.textContent = "Colonne N° étudiant";
      CN.el.mapLbl2.textContent = "Colonne NOM";
      CN.el.mapLbl3.textContent = "Colonne PRÉNOM";
      CN.el.mapLbl4.textContent = CN.app.modal.getLibelleColonneNote20(modalCtx.baremeSource);

      CN.app.util.remplirSelect(CN.el.mapSel1, fichierCourant.entetes, mappingCourant.colId || "");
      CN.app.util.remplirSelect(CN.el.mapSel2, fichierCourant.entetes, mappingCourant.colNom || "");
      CN.app.util.remplirSelect(CN.el.mapSel3, fichierCourant.entetes, mappingCourant.colPrenom || "");
      CN.app.util.remplirSelect(CN.el.mapSel4, fichierCourant.entetes, mappingCourant.colNote || "");
      return;
    }

    // Cas simple : un seul fichier
    CN.el.modalHint.textContent = modalCtx.hint;

    CN.ui.afficherBloc(CN.el.mapRow1, true);
    CN.ui.afficherBloc(CN.el.mapRow2, true);
    CN.ui.afficherBloc(CN.el.mapRow3, true);
    CN.ui.afficherBloc(CN.el.mapRow4, true);

    CN.el.mapLbl1.textContent = modalCtx.labels[0];
    CN.el.mapLbl2.textContent = modalCtx.labels[1];
    CN.el.mapLbl3.textContent = modalCtx.labels[2];
    CN.el.mapLbl4.textContent = modalCtx.labels[3];

    CN.app.util.remplirSelect(CN.el.mapSel1, modalCtx.entetes, modalCtx.mapping[modalCtx.keys[0]] || "");
    CN.app.util.remplirSelect(CN.el.mapSel2, modalCtx.entetes, modalCtx.mapping[modalCtx.keys[1]] || "");
    CN.app.util.remplirSelect(CN.el.mapSel3, modalCtx.entetes, modalCtx.mapping[modalCtx.keys[2]] || "");
    CN.app.util.remplirSelect(CN.el.mapSel4, modalCtx.entetes, modalCtx.mapping[modalCtx.keys[3]] || "");
  };

  CN.app.modal.estModalComposanteType = function (typeCalcul) {
    return !!(
      modalCtx &&
      modalCtx.mode === "composante" &&
      modalCtx.typeCalcul === typeCalcul
    );
  };

  CN.app.modal.sauverMappingPresCourant = function () {
    if (!CN.app.modal.estModalComposanteType("presence")) return;
    if (!modalCtx.presCurrentKey) return;

    modalCtx.mappingParFichier = modalCtx.mappingParFichier || {};

    modalCtx.mappingParFichier[modalCtx.presCurrentKey] = {
      colId: CN.el.mapSel1.value || null,
      colNom: CN.el.mapSel2.value || null,
      colPrenom: CN.el.mapSel3.value || null,
      colScore5: CN.el.mapSel4.value || null,
    };
  };

  CN.app.modal.installerPresMultiUI = function () {
    if (!CN.app.modal.estModalComposanteType("presence")) return;
    if (!Array.isArray(modalCtx.presFiles) || modalCtx.presFiles.length <= 1) return;

    let row = document.getElementById("presFileRow");
    if (row) return;

    const grid = CN.el.mapRow1?.parentElement;
    if (!grid || !grid.parentElement) return;

    row = document.createElement("label");
    row.id = "presFileRow";
    row.className = "champ";
    row.style.marginBottom = "12px";

    row.innerHTML = `
      <span class="champ-titre">Fichier de la composante</span>
      <select id="presFileSelect"></select>
    `;

    grid.parentElement.insertBefore(row, grid);

    const select = row.querySelector("#presFileSelect");

    for (const f of modalCtx.presFiles) {
      const opt = document.createElement("option");
      opt.value = f.key;
      opt.textContent = f.name;
      select.appendChild(opt);
    }

    select.value = modalCtx.presCurrentKey || modalCtx.presFiles[0].key;

    select.addEventListener("change", () => {
      CN.app.modal.sauverMappingPresCourant();
      modalCtx.presCurrentKey = select.value;
      CN.app.modal.rendreVueModalPresence();
    });
  };

  CN.app.modal.rendreVueModalPresence = function () {
    if (!CN.app.modal.estModalComposanteType("presence")) return;

    CN.app.modal.installerPresMultiUI();

    const presFiles = modalCtx.presFiles || [];
    if (!presFiles.length) return;

    let fichierCourant = presFiles.find(f => f.key === modalCtx.presCurrentKey);
    if (!fichierCourant) {
      fichierCourant = presFiles[0];
      modalCtx.presCurrentKey = fichierCourant.key;
    }

    const mappingCourant = modalCtx.mappingParFichier?.[fichierCourant.key] || {};

    const fileSelect = document.getElementById("presFileSelect");
    if (fileSelect) fileSelect.value = fichierCourant.key;

    CN.el.modalHint.textContent = presFiles.length > 1
      ? `Veuillez sélectionner les colonnes correspondant aux champs de « ${modalCtx.composanteNom} » pour le fichier « ${fichierCourant.name} ».`
      : `Veuillez sélectionner les colonnes correspondant aux champs de « ${modalCtx.composanteNom} ».`;

    CN.ui.afficherBloc(CN.el.mapRow1, true);
    CN.ui.afficherBloc(CN.el.mapRow2, true);
    CN.ui.afficherBloc(CN.el.mapRow3, true);
    CN.ui.afficherBloc(CN.el.mapRow4, true);

    CN.el.mapLbl1.textContent = "Colonne N° étudiant";
    CN.el.mapLbl2.textContent = "Colonne NOM";
    CN.el.mapLbl3.textContent = "Colonne PRÉNOM";
    CN.el.mapLbl4.textContent = "Colonne Score /5";

    CN.app.util.remplirSelect(CN.el.mapSel1, fichierCourant.entetes, mappingCourant.colId || "");
    CN.app.util.remplirSelect(CN.el.mapSel2, fichierCourant.entetes, mappingCourant.colNom || "");
    CN.app.util.remplirSelect(CN.el.mapSel3, fichierCourant.entetes, mappingCourant.colPrenom || "");
    CN.app.util.remplirSelect(CN.el.mapSel4, fichierCourant.entetes, mappingCourant.colScore5 || "");
  };

  // Met “Options avancées” dans la modal PIX
  CN.app.modal.installerPixAdvancedUI = function () {
    if (!CN.app.modal.estModalComposanteType("pix")) return;

    if (document.getElementById("pixAdvRow") && document.getElementById("pixAdvPanel")) {
      const selProg = document.getElementById("pixSelProg");
      const selShare = document.getElementById("pixSelShare");
      modalCtx.pixUI = { selProg, selShare };
      return;
    }

    const grid = CN.el.mapRow1?.parentElement;
    const actionRow = CN.el.btnModalSave?.parentElement;
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
    if (!CN.app.modal.estModalComposanteType("pix")) return;

    const advManquantes = !modalCtx.mapping.colProg || !modalCtx.mapping.colShare;

    CN.el.modalHint.textContent = advManquantes
      ? `Veuillez sélectionner les colonnes correspondant aux champs de « ${modalCtx.composanteNom} ». Les colonnes « % progression » et « Partage (O/N) » se trouvent dans « Options avancées ».`
      : `Veuillez sélectionner les colonnes correspondant aux champs de « ${modalCtx.composanteNom} ».`;

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

    // Si progression/partage manque, on ouvre directement les options avancées
    const advPanel = document.getElementById("pixAdvPanel");
    const advBtn = document.getElementById("btnPixAdv");
    if (advManquantes && advPanel && advBtn) {
      CN.ui.afficherBloc(advPanel, true);
      advBtn.innerHTML = `Masquer les options avancées <span class="chev">▴</span>`;
    }
  };

  // Avant d’enregistrer : recopie ce que l’utilisateur a choisi dans modalCtx.mapping
  CN.app.modal.syncModalToMappingAvantSave = function () {
    if (!modalCtx) return;

    if (modalCtx.mode === "pegase") {
      modalCtx.mapping[modalCtx.keys[0]] = CN.el.mapSel1.value;
      modalCtx.mapping[modalCtx.keys[1]] = CN.el.mapSel2.value;
      modalCtx.mapping[modalCtx.keys[2]] = CN.el.mapSel3.value;
      modalCtx.mapping[modalCtx.keys[3]] = CN.el.mapSel4.value;
      return;
    }

    if (modalCtx.mode !== "composante") return;

    if (modalCtx.typeCalcul === "presence") {
      CN.app.modal.sauverMappingPresCourant();
      return;
    }

    if (modalCtx.typeCalcul === "pix") {
      modalCtx.mapping.colId = CN.el.mapSel1.value;
      modalCtx.mapping.colNom = CN.el.mapSel2.value;
      modalCtx.mapping.colPrenom = CN.el.mapSel3.value;
      modalCtx.mapping.colScore = CN.el.mapSel4.value;

      const selProg = document.getElementById("pixSelProg");
      const selShare = document.getElementById("pixSelShare");
      if (selProg) modalCtx.mapping.colProg = selProg.value;
      if (selShare) modalCtx.mapping.colShare = selShare.value;
      return;
    }

    if (modalCtx.typeCalcul === "note20" && Array.isArray(modalCtx.note20Files) && modalCtx.note20Files.length > 1) {
      CN.app.modal.sauverMappingNote20Courant();
      return;
    }

    modalCtx.mapping[modalCtx.keys[0]] = CN.el.mapSel1.value;
    modalCtx.mapping[modalCtx.keys[1]] = CN.el.mapSel2.value;
    modalCtx.mapping[modalCtx.keys[2]] = CN.el.mapSel3.value;
    modalCtx.mapping[modalCtx.keys[3]] = CN.el.mapSel4.value;
  };

  // Modal PEGASE (reste à part du système des composantes)
  CN.app.modal.ouvrirModalMappingPegase = async function () {
    const fPeg = CN.el.fichierPegase.files[0] || null;
    if (!fPeg) {
      return CN.ui.ajouterMessage("warn", "Veuillez d'abord sélectionner le fichier PEGASE.");
    }

    CN.app.modal.detruirePixAdvancedUI();
    CN.app.modal.detruirePresMultiUI();
    CN.app.modal.detruireNote20MultiUI();

    const r = await CN.imports.lireApercuCSV(fPeg);
    const entetes = r.entetes;
    const lignesPreview = r.lignes;

    CN.etat.entetesPegase = entetes;
    CN.etat.mappingPegase.delimiteur = r.delim;

    const def = CN.imports.proposerMappingPegase(entetes, lignesPreview);
    const current = CN.app.util.fusionMapping(def, CN.etat.mappingPegase, entetes);

    modalCtx = {
      mode: "pegase",
      entetes,
      labels: ["Colonne N° étudiant", "Colonne NOM", "Colonne PRÉNOM", "Colonne NOTE à remplir"],
      keys: ["colId", "colNom", "colPrenom", "colNote"],
      mapping: CN.app.util.copier(current),
      hint: "Veuillez sélectionner les colonnes correspondant aux champs PEGASE."
    };

    CN.el.modalTitle.textContent = "Paramétrage PEGASE";
    CN.el.modalHint.textContent = modalCtx.hint;

    CN.ui.afficherBloc(CN.el.mapRow1, true);
    CN.ui.afficherBloc(CN.el.mapRow2, true);
    CN.ui.afficherBloc(CN.el.mapRow3, true);
    CN.ui.afficherBloc(CN.el.mapRow4, true);

    CN.el.mapLbl1.textContent = modalCtx.labels[0];
    CN.el.mapLbl2.textContent = modalCtx.labels[1];
    CN.el.mapLbl3.textContent = modalCtx.labels[2];
    CN.el.mapLbl4.textContent = modalCtx.labels[3];

    CN.app.util.remplirSelect(CN.el.mapSel1, entetes, modalCtx.mapping[modalCtx.keys[0]] || "");
    CN.app.util.remplirSelect(CN.el.mapSel2, entetes, modalCtx.mapping[modalCtx.keys[1]] || "");
    CN.app.util.remplirSelect(CN.el.mapSel3, entetes, modalCtx.mapping[modalCtx.keys[2]] || "");
    CN.app.util.remplirSelect(CN.el.mapSel4, entetes, modalCtx.mapping[modalCtx.keys[3]] || "");

    CN.ui.afficherBloc(CN.el.modalOverlay, true);
  };

  // Modal de mapping générique pilotée par une composante
  CN.app.modal.ouvrirModalMappingComposante = async function (composanteId) {
    const comp = CN.utils.getComposanteById(composanteId);
    if (!comp) {
      return CN.ui.ajouterMessage("warn", `Composante introuvable : ${composanteId}`);
    }

    const files = CN.app.pipeline.getFilesComposante(comp);

    CN.app.modal.detruirePixAdvancedUI();
    CN.app.modal.detruirePresMultiUI();
    CN.app.modal.detruireNote20MultiUI();

    const typeCalcul = (comp.typeCalcul || "").toString().trim().toLowerCase();

    // PIX
    if (typeCalcul === "pix") {
      if (!files.length) {
        return CN.ui.ajouterMessage("warn", `Veuillez d'abord sélectionner le fichier ${comp.nom}.`);
      }

      const r = await CN.imports.lireApercuCSV(files[0]);
      const def = CN.imports.proposerMappingComposante(comp, r.entetes, r.lignes);
      const existant = comp.mapping || {};
      const current = CN.app.util.fusionMapping(def, existant, r.entetes);

      modalCtx = {
        mode: "composante",
        composanteId: comp.id,
        composanteNom: comp.nom,
        typeCalcul,
        multiFichiers: !!comp.multiFichiers,
        entetes: r.entetes,
        mapping: CN.app.util.copier(current),
        pixUI: null
      };
    }

    // Présences / composante multi-fichiers sur /5
    if (typeCalcul === "presence") {
      if (!files.length) {
        return CN.ui.ajouterMessage("warn", `Veuillez d'abord sélectionner au moins un fichier pour « ${comp.nom} ».`);
      }

      const presFiles = [];
      const mappingParFichier = {};

      for (const fichier of files) {
        const r = await CN.imports.lireApercuCSV(fichier);
        const cle = CN.utils.cleFichier(fichier);

        const def = CN.imports.proposerMappingComposante(comp, r.entetes, r.lignes);
        const existant = {
          ...(comp.mapping || {}),
          ...(comp.mappingParFichier?.[cle] || {})
        };

        const current = CN.app.util.fusionMapping(def, existant, r.entetes);

        presFiles.push({
          key: cle,
          name: fichier.name,
          entetes: r.entetes,
          lignes: r.lignes,
          delim: r.delim
        });

        mappingParFichier[cle] = CN.app.util.copier(current);
      }

      modalCtx = {
        mode: "composante",
        composanteId: comp.id,
        composanteNom: comp.nom,
        typeCalcul,
        multiFichiers: !!comp.multiFichiers,
        presFiles,
        presCurrentKey: presFiles[0]?.key || "",
        mappingParFichier
      };
    }

    // Composante standard notée sur 20
    if (typeCalcul === "note20") {
      if (!files.length) {
        return CN.ui.ajouterMessage("warn", `Veuillez d'abord sélectionner le fichier ${comp.nom}.`);
      }

      // Cas multi-fichiers : même logique que Présences, mais NOTE /20
      if (comp.multiFichiers && files.length > 1) {
        const note20Files = [];
        const mappingParFichier = {};

        for (const fichier of files) {
          const r = await CN.imports.lireApercuCSV(fichier);
          const cle = CN.utils.cleFichier(fichier);

          const def = CN.imports.proposerMappingComposante(comp, r.entetes, r.lignes);
          const existant = {
            ...(comp.mapping || {}),
            ...(comp.mappingParFichier?.[cle] || {})
          };

          const current = CN.app.util.fusionMapping(def, existant, r.entetes);

          note20Files.push({
            key: cle,
            name: fichier.name,
            entetes: r.entetes,
            lignes: r.lignes,
            delim: r.delim
          });

          mappingParFichier[cle] = CN.app.util.copier(current);
        }

        modalCtx = {
          mode: "composante",
          composanteId: comp.id,
          composanteNom: comp.nom,
          typeCalcul,
          multiFichiers: true,
          note20Files,
          note20CurrentKey: note20Files[0]?.key || "",
          mappingParFichier,
          baremeSource: CN.utils.normaliserBaremeSource(comp.baremeSource, 20),
          labels: [
            "Colonne N° étudiant",
            "Colonne NOM",
            "Colonne PRÉNOM",
            CN.app.modal.getLibelleColonneNote20(comp.baremeSource)
          ],
          keys: ["colId", "colNom", "colPrenom", "colNote"],
          hint: `Veuillez sélectionner les colonnes correspondant aux champs de « ${comp.nom} ».`
        };
      } else {
        const r = await CN.imports.lireApercuCSV(files[0]);

        const def = CN.imports.proposerMappingComposante(comp, r.entetes, r.lignes);
        const existant = comp.mapping || {};
        const current = CN.app.util.fusionMapping(def, existant, r.entetes);

        modalCtx = {
          mode: "composante",
          composanteId: comp.id,
          composanteNom: comp.nom,
          typeCalcul,
          multiFichiers: !!comp.multiFichiers,
          entetes: r.entetes,
          baremeSource: CN.utils.normaliserBaremeSource(comp.baremeSource, 20),
          labels: [
            "Colonne N° étudiant",
            "Colonne NOM",
            "Colonne PRÉNOM",
            CN.app.modal.getLibelleColonneNote20(comp.baremeSource)
          ],
          keys: ["colId", "colNom", "colPrenom", "colNote"],
          mapping: CN.app.util.copier(current),
          hint: `Veuillez sélectionner les colonnes correspondant aux champs de « ${comp.nom} ».`
        };
      }
    }

    if (!modalCtx) {
      return CN.ui.ajouterMessage("danger", `Type de composante non pris en charge : ${typeCalcul}`);
    }

    CN.el.modalTitle.textContent = `Paramétrage ${comp.nom}`;

    CN.ui.afficherBloc(CN.el.mapRow1, true);
    CN.ui.afficherBloc(CN.el.mapRow2, true);
    CN.ui.afficherBloc(CN.el.mapRow3, true);
    CN.ui.afficherBloc(CN.el.mapRow4, true);

    if (typeCalcul === "pix") {
      CN.app.modal.rendreVueModalPix();
    } else if (typeCalcul === "presence") {
      CN.app.modal.rendreVueModalPresence();
    } else if (typeCalcul === "note20") {
      CN.app.modal.rendreVueModalNote20();
    } else {
      CN.el.modalHint.textContent = modalCtx.hint;

      CN.el.mapLbl1.textContent = modalCtx.labels[0];
      CN.el.mapLbl2.textContent = modalCtx.labels[1];
      CN.el.mapLbl3.textContent = modalCtx.labels[2];
      CN.el.mapLbl4.textContent = modalCtx.labels[3];

      CN.app.util.remplirSelect(CN.el.mapSel1, modalCtx.entetes, modalCtx.mapping[modalCtx.keys[0]] || "");
      CN.app.util.remplirSelect(CN.el.mapSel2, modalCtx.entetes, modalCtx.mapping[modalCtx.keys[1]] || "");
      CN.app.util.remplirSelect(CN.el.mapSel3, modalCtx.entetes, modalCtx.mapping[modalCtx.keys[2]] || "");
      CN.app.util.remplirSelect(CN.el.mapSel4, modalCtx.entetes, modalCtx.mapping[modalCtx.keys[3]] || "");
    }

    CN.ui.afficherBloc(CN.el.modalOverlay, true);
  };

  // Ferme la modal
  CN.app.modal.fermerModalMapping = function () {
    CN.app.modal.detruirePixAdvancedUI();
    CN.app.modal.detruirePresMultiUI();
    CN.app.modal.detruireNote20MultiUI();
    modalCtx = null;
    CN.ui.afficherBloc(CN.el.modalOverlay, false);
  };

  // Enregistre le mapping choisi, puis relance proprement l’analyse
  CN.app.modal.enregistrerModalMapping = async function () {
    if (!modalCtx) return;

    CN.app.modal.syncModalToMappingAvantSave();

    if (modalCtx.mode === "pegase") {
      CN.etat.mappingPegase.colId = modalCtx.mapping.colId;
      CN.etat.mappingPegase.colNom = modalCtx.mapping.colNom;
      CN.etat.mappingPegase.colPrenom = modalCtx.mapping.colPrenom;
      CN.etat.mappingPegase.colNote = modalCtx.mapping.colNote;
    }

    if (modalCtx.mode === "composante") {
      const comp = CN.utils.getComposanteById(modalCtx.composanteId);

      if (comp) {
        if (modalCtx.typeCalcul === "presence") {
          comp.mappingParFichier = CN.app.util.copier(modalCtx.mappingParFichier || {});
          const premiereCle = modalCtx.presFiles?.[0]?.key || "";
          comp.mapping = CN.app.util.copier(comp.mappingParFichier[premiereCle] || {});
        } else if (modalCtx.typeCalcul === "note20" && Array.isArray(modalCtx.note20Files) && modalCtx.note20Files.length > 1) {
          comp.mappingParFichier = CN.app.util.copier(modalCtx.mappingParFichier || {});
          const premiereCle = modalCtx.note20Files?.[0]?.key || "";
          comp.mapping = CN.app.util.copier(comp.mappingParFichier[premiereCle] || {});
        } else {
          comp.mapping = CN.app.util.copier(modalCtx.mapping || {});
        }
      }
    }

    CN.app.modal.fermerModalMapping();

    const doitRelancerAnalyse = CN.etat.analyseDejaLancee === true;

    if (doitRelancerAnalyse) {
      try {
        await CN.app.pipeline.executerAnalyse();
        CN.ui.ajouterMessage("ok", "Paramétrage enregistré et analyse relancée.");
      } catch (e) {
        CN.ui.ajouterMessage("danger", "Erreur après enregistrement du paramétrage : " + e.message);
        console.error(e);
      }
    } else {
      CN.ui.ajouterMessage("info", "Paramétrage enregistré.");
    }
  };

  // Config

  CN.app.config.calcConfigFromUI = function () {
    return {
      modeRemplissage: (CN.etat.config?.modeRemplissage || "ne_rien_ecraser").toString(),
      arrondiActif: CN.etat.config?.arrondiActif !== false,
      arrondiMethode: (CN.etat.config?.arrondiMethode || "classique").toString(),
      arrondiPrecision: (CN.etat.config?.arrondiPrecision || "centieme").toString(),
      modePonderation: CN.app.config.normaliserModePonderation(
        CN.el.modePonderation?.value || CN.etat.config?.modePonderation || "points"
      )
    };
  };

  CN.app.config.nbComposantesSelectionnees = function () {
    const comps = Array.isArray(CN.etat.composantes) ? CN.etat.composantes : [];
    return comps.filter(c => c && c.actif).length;
  };

  // Synchronise les composantes dynamiques à partir de l’UI classique dynamique
  CN.app.config.syncComposantesDepuisUIClassique = function () {
    if (CN.utils.estModeLibre()) return;

    if (!Array.isArray(CN.etat.composantes) || !CN.etat.composantes.length) {
      CN.etat.composantes = CN.utils.creerComposantesModeClassique();
    }

    CN.etat.modeSaisie = "classique";

    for (const comp of CN.etat.composantes) {
      if (!comp) continue;

      const chk = CN.app.config.getInputActifComposanteClassique(comp.id);
      const input = CN.app.config.getInputPoidsComposanteClassique(comp.id);

      if (chk) {
        comp.actif = !!chk.checked;
      }

      if (input) {
        let valeur = Number.isFinite(input.valueAsNumber)
          ? input.valueAsNumber
          : CN.data.toNombreFR(input.value);

        if (!Number.isFinite(valeur)) valeur = 0;

        CN.app.config.setValeurSaisiePonderation(comp, valeur);
      }

      if (!comp.actif) {
        comp.poids = 0;
      }
    }
  };

  // Applique les règles :
  // - total = 20
  // - si 1 composante => elle prend 20
  // - si plusieurs => chaque pondération > 0
  CN.app.config.appliquerReglesConfig = function () {
    CN.app.config.syncModePonderationDepuisUI();

    const modeLibre = CN.utils.estModeLibre();
    CN.app.config.majAffichageModeSaisie();

    // MODE LIBRE
    if (modeLibre) {
      CN.app.config.normaliserComposantesModeLibre();

      let comps = Array.isArray(CN.etat.composantes) ? CN.etat.composantes.filter(Boolean) : [];
      CN.etat.composantes = comps;

      const res = CN.app.config.calculerPonderationEffective(comps);

      CN.app.config.afficherTotalPonderation(
        res.totalAffiche,
        res.erreurs.length > 0
      );

      if (res.erreurs.length) {
        CN.el.configError.textContent = res.erreurs.join(" ");
        CN.ui.afficherBloc(CN.el.configError, true);
        CN.el.btnAnalyser.disabled = true;
      } else {
        CN.ui.afficherBloc(CN.el.configError, false);
        CN.el.btnAnalyser.disabled = false;
        CN.etat.config = CN.app.config.calcConfigFromUI();
      }

      CN.app.config.sauverEtatModeLibre();
      CN.app.config.rendreListeComposantesLibres();
      CN.app.dropzones.rendreImportsModeLibre();
      CN.app.dropzones.majBoutonsConfig();
      CN.app.dropzones.majStatusPills();
      return;
    }

    // MODE CLASSIQUE
    CN.app.config.syncComposantesDepuisUIClassique();

    let comps = Array.isArray(CN.etat.composantes) ? CN.etat.composantes.filter(Boolean) : [];
    CN.etat.composantes = comps;

    const res = CN.app.config.calculerPonderationEffective(comps);

    CN.app.config.afficherTotalPonderation(
      res.totalAffiche,
      res.erreurs.length > 0
    );

    if (res.erreurs.length) {
      CN.el.configError.textContent = res.erreurs.join(" ");
      CN.ui.afficherBloc(CN.el.configError, true);
      CN.el.btnAnalyser.disabled = true;
    } else {
      CN.ui.afficherBloc(CN.el.configError, false);
      CN.el.btnAnalyser.disabled = false;
      CN.etat.config = CN.app.config.calcConfigFromUI();
    }

    // Si une composante classique est décochée, on supprime ses fichiers mémorisés
    for (const comp of comps) {
      if (!comp.actif && CN.etat.fichiersComposantesClassiques?.[comp.id]) {
        delete CN.etat.fichiersComposantesClassiques[comp.id];
      }
    }

    // On mémorise l’état actuel du mode classique
    CN.app.config.sauverEtatModeClassique();

    CN.app.config.rendreListeComposantesClassiques();
    CN.app.dropzones.rendreImportsModeClassique();
    CN.app.dropzones.majBoutonsConfig();
    CN.app.dropzones.majStatusPills();
  };

  // Dropzones + statuts

  CN.app.dropzones.majBoutonsConfig = function () {
    const aPegase = !!(CN.el.fichierPegase?.files && CN.el.fichierPegase.files.length);

    if (CN.el.btnCfgPegase) {
      CN.el.btnCfgPegase.disabled = !aPegase;
    }

    if (CN.el.btnClearPegase) {
      CN.el.btnClearPegase.disabled = !aPegase;
    }

    const btnCfgPegaseFree = document.getElementById("btnCfgPegaseFree");
    if (btnCfgPegaseFree) {
      btnCfgPegaseFree.disabled = !aPegase;
    }

    const btnClearPegaseFree = document.getElementById("btnClearPegaseFree");
    if (btnClearPegaseFree) {
      btnClearPegaseFree.disabled = !aPegase;
    }

    document.querySelectorAll('[data-action="cfg-comp"]').forEach(btn => {
      const comp = CN.utils.getComposanteById(btn.dataset.compId);
      const files = CN.app.pipeline.getFilesComposante(comp);
      btn.disabled = !(files && files.length);
    });

    document.querySelectorAll('[data-action="clear-comp"]').forEach(btn => {
      const comp = CN.utils.getComposanteById(btn.dataset.compId);
      const files = CN.app.pipeline.getFilesComposante(comp);
      btn.disabled = !(files && files.length);
    });
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
    const chargePegase = !!(CN.el.fichierPegase?.files && CN.el.fichierPegase.files.length);

    const blocPegase = document.getElementById("blocPegase");
    CN.app.dropzones.setStatusPill(blocPegase, chargePegase);

    const blocPegaseFree = document.getElementById("blocPegaseFree");
    CN.app.dropzones.setStatusPill(blocPegaseFree, chargePegase);

    document.querySelectorAll("[data-comp-card]").forEach(card => {
      const comp = CN.utils.getComposanteById(card.dataset.compCard);
      const files = CN.app.pipeline.getFilesComposante(comp);
      CN.app.dropzones.setStatusPill(card, !!(files && files.length));
    });
  };

  // Gère click + drag&drop pour toutes les zones .dropzone
  CN.app.dropzones.bindDropzones = function () {
    document.querySelectorAll(".dropzone").forEach((dz) => {
      if (dz.dataset.boundDropzone === "1") return;

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

      dz.dataset.boundDropzone = "1";
    });

    document.querySelectorAll('input[type="file"]').forEach((input) => {
      if (input.dataset.boundFileChange === "1") return;

      input.addEventListener("change", () => {
        // Fichiers dynamiques des composantes (mode classique ou libre)
        if (input.dataset.compId) {
          const compId = input.dataset.compId;
          const comp = CN.utils.getComposanteById(compId);
          const files = Array.from(input.files || []);

          if (comp) {
            comp.brut = null;
            comp.resultat = null;
          }

          CN.app.dropzones.invaliderResultatsAnalyse();

          const storeName = input.dataset.compMode === "classique"
            ? "fichiersComposantesClassiques"
            : "fichiersComposantes";

          CN.etat[storeName] = CN.etat[storeName] || {};
          CN.etat[storeName][compId] = comp?.multiFichiers ? files : files.slice(0, 1);

          const classicLabel = document.querySelector(`[data-classic-dz-name="${compId}"]`);
          if (classicLabel && input.dataset.compMode === "classique") {
            classicLabel.textContent = CN.app.dropzones.getTexteSelectionFichiersComposante(
              comp,
              CN.etat[storeName][compId]
            );
          }

          const freeLabel = document.querySelector(`[data-free-dz-name="${compId}"]`);
          if (freeLabel && input.dataset.compMode !== "classique") {
            freeLabel.textContent = CN.app.dropzones.getTexteSelectionFichiersComposante(
              comp,
              CN.etat[storeName][compId]
            );
          }

          CN.app.dropzones.majBoutonsConfig();
          CN.app.dropzones.majStatusPills();
          return;
        }

        if (input === CN.el.fichierPegase) {
          CN.etat.pegase = null;
          CN.etat.pegaseRempli = null;
          CN.etat.entetesPegase = null;

          CN.app.dropzones.invaliderResultatsAnalyse();
          CN.ui.setDZText("peg", CN.el.fichierPegase.files);
        }

        CN.app.dropzones.majBoutonsConfig();
        CN.app.dropzones.majStatusPills();
      });

      input.dataset.boundFileChange = "1";
    });
  };

  // Analyse + recalcul

  CN.app.pipeline.getFilesComposante = function (composante) {
    if (!composante) return [];

    const store = CN.utils.estModeLibre()
      ? (CN.etat.fichiersComposantes || {})
      : (CN.etat.fichiersComposantesClassiques || {});

    const files = Array.from(store[composante.id] || []);
    return composante.multiFichiers ? files : files.slice(0, 1);
  };

  CN.app.pipeline.syncMappingEtatVersComposante = function (composante) {
    if (!composante) return;

    composante.mapping = CN.app.util.copier(
      composante.mapping || CN.utils.creerMappingVidePourType(composante.typeCalcul)
    );
    composante.mappingParFichier = CN.app.util.copier(composante.mappingParFichier || {});
  };

  CN.app.pipeline.appliquerChargementComposante = function (composante, charge) {
    if (!composante) return;

    composante.brut = charge?.brut || null;
    composante.resultat = charge?.resultat || null;
  };

  CN.app.pipeline.reinitialiserImportsComposantes = function () {
    const comps = Array.isArray(CN.etat.composantes) ? CN.etat.composantes : [];
    for (const comp of comps) {
      if (!comp) continue;
      comp.brut = null;
      comp.resultat = null;
    }
  };

  // Recharge uniquement la source concernée après un changement de mapping
  CN.app.pipeline.reimporterSiBesoin = async function (type) {
    const comp = CN.utils.getComposanteById(type);
    if (!comp || !comp.actif) return;

    CN.app.pipeline.syncMappingEtatVersComposante(comp);

    const files = CN.app.pipeline.getFilesComposante(comp);
    const charge = await CN.imports.chargerComposante(comp, files, CN.etat.config);

    CN.app.pipeline.appliquerChargementComposante(comp, charge);
  };

  // Vérifie les mappings nécessaires avant les imports
  CN.app.pipeline.verifierMappingsAvantImport = async function () {
    const composantesActives = CN.utils.getComposantesActives();

    for (const comp of composantesActives) {
      const files = CN.app.pipeline.getFilesComposante(comp);
      if (!files.length) continue;

      if (comp.typeCalcul === "pix") {
        const rPix = await CN.imports.lireApercuCSV(files[0]);

        const defPix = CN.imports.proposerMappingComposante(comp, rPix.entetes, rPix.lignes);
        const mergedPix = CN.app.util.fusionMapping(defPix, comp.mapping || {}, rPix.entetes);

        comp.mapping = CN.app.util.copier(mergedPix);

        if (!CN.app.util.mappingComplet(comp.mapping, ["colId", "colScore", "colProg", "colShare"])) {
          CN.ui.ajouterMessage("warn", `${comp.nom} : paramétrage requis - veuillez sélectionner les colonnes, puis cliquer sur « Enregistrer ».`);
          await CN.app.modal.ouvrirModalMappingComposante(comp.id);
          return false;
        }

        continue;
      }

      if (comp.typeCalcul === "presence") {
        const mappingParFichier = {};
        let mappingIncomplet = false;

        for (const fichier of files) {
          const rPres = await CN.imports.lireApercuCSV(fichier);
          const cle = CN.utils.cleFichier(fichier);

          const defPres = CN.imports.proposerMappingComposante(comp, rPres.entetes, rPres.lignes);
          const existant = {
            ...(comp.mapping || {}),
            ...(comp.mappingParFichier?.[cle] || {})
          };

          const mergedPres = CN.app.util.fusionMapping(defPres, existant, rPres.entetes);
          mappingParFichier[cle] = mergedPres;

          if (!CN.app.util.mappingComplet(mergedPres, ["colId", "colNom", "colPrenom", "colScore5"])) {
            mappingIncomplet = true;
          }
        }

        comp.mappingParFichier = CN.app.util.copier(mappingParFichier);

        const premiereCle = CN.utils.cleFichier(files[0]);
        comp.mapping = CN.app.util.copier(mappingParFichier[premiereCle] || {});

        if (mappingIncomplet) {
          CN.ui.ajouterMessage("warn", `${comp.nom} : paramétrage requis - veuillez sélectionner les colonnes pour chaque fichier, puis cliquer sur « Enregistrer ».`);
          await CN.app.modal.ouvrirModalMappingComposante(comp.id);
          return false;
        }

        continue;
      }

      if (comp.typeCalcul === "note20") {
        if (comp.multiFichiers && files.length > 1) {
          const mappingParFichier = {};
          let mappingIncomplet = false;

          for (const fichier of files) {
            const rNote20 = await CN.imports.lireApercuCSV(fichier);
            const cle = CN.utils.cleFichier(fichier);

            const defNote20 = CN.imports.proposerMappingComposante(comp, rNote20.entetes, rNote20.lignes);
            const existantNote20 = {
              ...(comp.mapping || {}),
              ...(comp.mappingParFichier?.[cle] || {})
            };

            const mergedNote20 = CN.app.util.fusionMapping(defNote20, existantNote20, rNote20.entetes);
            mappingParFichier[cle] = mergedNote20;

            if (!CN.app.util.mappingComplet(mergedNote20, ["colId", "colNom", "colPrenom", "colNote"])) {
              mappingIncomplet = true;
            }
          }

          comp.mappingParFichier = CN.app.util.copier(mappingParFichier);

          const premiereCle = CN.utils.cleFichier(files[0]);
          comp.mapping = CN.app.util.copier(mappingParFichier[premiereCle] || {});

          if (mappingIncomplet) {
            CN.ui.ajouterMessage("warn", `${comp.nom} : paramétrage requis - veuillez sélectionner les colonnes pour chaque fichier, puis cliquer sur « Enregistrer ».`);
            await CN.app.modal.ouvrirModalMappingComposante(comp.id);
            return false;
          }

          continue;
        }

        const rNote20 = await CN.imports.lireApercuCSV(files[0]);

        const defNote20 = CN.imports.proposerMappingComposante(comp, rNote20.entetes, rNote20.lignes);
        const mergedNote20 = CN.app.util.fusionMapping(defNote20, comp.mapping || {}, rNote20.entetes);

        comp.mapping = CN.app.util.copier(mergedNote20);

        if (!CN.app.util.mappingComplet(comp.mapping, ["colId", "colNom", "colPrenom", "colNote"])) {
          CN.ui.ajouterMessage("warn", `${comp.nom} : paramétrage requis - veuillez sélectionner les colonnes, puis cliquer sur « Enregistrer ».`);
          await CN.app.modal.ouvrirModalMappingComposante(comp.id);
          return false;
        }
      }
    }

    return true;
  };

  // Analyser => imports => calcul => affichage
  CN.app.pipeline.executerAnalyse = async function () {
    CN.etat.analyseDejaLancee = true;

    CN.ui.viderMessages();
    CN.ui.afficherBloc(CN.el.zoneResultats, false);

    CN.app.config.appliquerReglesConfig();
    const cfg = CN.etat.config;

    const fPeg = CN.el.fichierPegase.files[0] || null;
    const avecPegase = !!fPeg;
    CN.etat.modeSansPegase = !avecPegase;

    const composantesActives = CN.utils.getComposantesActives();

    // On repart de résultats propres pour les composantes
    CN.app.pipeline.reinitialiserImportsComposantes();

    if (!avecPegase) {
      CN.ui.ajouterMessage(
        "info",
        "Analyse sans fichier PEGASE : le calcul sera effectué uniquement à partir des composants importés. Le CSV \"PEGASE rempli\" ne sera pas généré."
      );
    }

    // Avertissements si composante active sans fichier
    for (const comp of composantesActives) {
      const files = CN.app.pipeline.getFilesComposante(comp);
      if (!files.length) {
        CN.ui.ajouterMessage("warn", `${comp.nom} sélectionné mais aucun fichier importé - contribution ${comp.nom} = 0.`);
      }
    }

    // PEGASE
    if (avecPegase) {
      CN.ui.ajouterMessage("info", "Lecture PEGASE…");
      CN.etat.pegase = await CN.imports.chargerPEGASE(fPeg);
      CN.etat.entetesPegase = CN.etat.pegase.entetes;

      // On s’assure que le mapping PEGASE est cohérent avec les entêtes
      const defPeg = CN.imports.proposerMappingPegase(CN.etat.pegase.entetes, CN.etat.pegase.lignes);
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

    // Vérification des mappings avant import réel
    if (!(await CN.app.pipeline.verifierMappingsAvantImport())) {
      return;
    }

    // Import réel des composantes
    for (const comp of composantesActives) {
      CN.app.pipeline.syncMappingEtatVersComposante(comp);

      const files = CN.app.pipeline.getFilesComposante(comp);

      if (!files.length) {
        const chargeVide = await CN.imports.chargerComposante(comp, [], cfg);
        CN.app.pipeline.appliquerChargementComposante(comp, chargeVide);
        continue;
      }

      CN.ui.ajouterMessage("info", `Lecture ${comp.nom}…`);
      const charge = await CN.imports.chargerComposante(comp, files, cfg);
      CN.app.pipeline.appliquerChargementComposante(comp, charge);
    }

    await CN.app.pipeline.recalculer();
  };

  // Construit les statistiques du résumé pour chaque composante active
  CN.app.pipeline.construireStatsComposantes = function (composantes) {
    const comps = Array.isArray(composantes) ? composantes : [];

    return comps.map((comp) => {
      const resultat = comp?.resultat || null;
      const nbFichiers = CN.app.pipeline.getFilesComposante(comp).length;

      let nbValides = 0;
      if (comp?.typeCalcul === "pix") {
        nbValides = resultat?.nbValides ?? 0;
      } else if (resultat?.map instanceof Map) {
        nbValides = resultat.map.size;
      } else {
        nbValides = resultat?.nbValides ?? 0;
      }

      const nbInvalides = Array.isArray(resultat?.invalides)
        ? resultat.invalides.length
        : 0;

      return {
        id: comp?.id || "",
        nom: comp?.nom || comp?.id || "Composante",
        poids: Number.isFinite(comp?.poids) ? comp.poids : 0,
        coefficient: Number.isFinite(CN.data.toNombreFR(comp?.coefficient)) ? CN.data.toNombreFR(comp.coefficient) : null,
        typeCalcul: comp?.typeCalcul || "",
        baremeSource: Number.isFinite(comp?.baremeSource) ? comp.baremeSource : null,
        nbValides,
        nbInvalides,
        nbFichiers
      };
    });
  };

  // Recalcule les notes/anomalies + met à jour le résumé et les tableaux
  CN.app.pipeline.recalculer = async function () {
    const cfg = CN.etat.config;
    const avecPegase = !!CN.etat.pegase;

    if (avecPegase) {
      if (!CN.app.util.mappingComplet(CN.etat.mappingPegase, ["colId", "colNom", "colPrenom", "colNote"])) {
        CN.ui.ajouterMessage("warn", "PEGASE : paramétrage requis.");
        await CN.app.modal.ouvrirModalMappingPegase();
        return;
      }
    }

    const composantesActives = CN.utils.getComposantesActives();
    const build = CN.traitement.construireNotesDynamiques(cfg, composantesActives);

    const remplissage = avecPegase
      ? CN.traitement.remplirPegase(
        CN.etat.pegase,
        CN.etat.mappingPegase,
        build.notes,
        cfg
      )
      : { lignesOut: [], nbEcrits: 0, nbIgnores: 0, nbABI: 0, inconnus: [] };

    const ana = CN.traitement.analyserAnomalies(
      avecPegase ? CN.etat.pegase : null,
      avecPegase ? CN.etat.mappingPegase : null,
      composantesActives,
      build
    );

    // Sauvegarde dans l’état global
    CN.etat.notes = build.notes;
    CN.etat.pegaseRempli = remplissage;
    CN.etat.anomalies = ana.anomalies;
    CN.etat.anomaliesParId = ana.anomaliesParId;

    // Construction de l’aperçu (table principale)
    CN.etat.apercu = CN.affichage.rendreTableApercu(
      CN.etat.pegase,
      CN.etat.mappingPegase,
      CN.etat.notes,
      CN.etat.anomaliesParId,
      cfg
    );

    // Compteur de lignes dans l'onglet aperçu
    if (CN.el.countApercu) {
      CN.el.countApercu.textContent = String(CN.etat.apercu?.lignes?.length || 0);
    }

    // Résumé
    CN.el.resume.innerHTML = "";
    const stats = {
      avecPegase,
      pegaseLignes: avecPegase ? CN.etat.pegase.lignes.length : 0,
      composantes: CN.app.pipeline.construireStatsComposantes(composantesActives),
      nbEcrits: remplissage.nbEcrits,
      nbIgnores: remplissage.nbIgnores,
      nbABI: remplissage.nbABI,
      nbAnomalies: CN.etat.anomalies.length,
    };
    CN.el.resume.appendChild(CN.affichage.construireResume(stats, cfg));

    // Tableau aperçu paginé
    CN.affichage.filtrerApercu(CN.etat.apercu, { resetPage: true });

    // Tableau anomalies (aperçu)
    const listAno = CN.etat.anomalies || [];

    // Compteur de lignes dans l'onglet anomalies
    if (CN.el.countAnomalies) {
      CN.el.countAnomalies.textContent = String(listAno.length);
    }

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

    CN.etat.tableAnomaliesData = {
      entetes: entAno,
      lignes: lignesAno,
      labels: null
    };

    CN.affichage.remplirFiltreTypesAnomalies(CN.etat.tableAnomaliesData);
    CN.affichage.filtrerAnomalies(CN.etat.tableAnomaliesData, { resetPage: true });

    // Affiche la zone résultats
    CN.ui.afficherBloc(CN.el.zoneResultats, true);

    // Après chaque analyse, on revient automatiquement sur l'onglet principal
    CN.app.main.activerOngletResultats("apercu");

    // Filtre/recherche : on revient à la page 1 après chaque changement
    CN.el.recherche.oninput = () => CN.affichage.filtrerApercu(CN.etat.apercu, { resetPage: true });
    CN.el.filtreAnomalies.onchange = () => CN.affichage.filtrerApercu(CN.etat.apercu, { resetPage: true });

    if (CN.el.rechercheAnomalies) {
      CN.el.rechercheAnomalies.oninput = () => {
        CN.affichage.filtrerAnomalies(CN.etat.tableAnomaliesData, { resetPage: true });
      };
    }

    if (CN.el.filtreTypeAnomalies) {
      CN.el.filtreTypeAnomalies.onchange = () => {
        CN.affichage.filtrerAnomalies(CN.etat.tableAnomaliesData, { resetPage: true });
      };
    }

    // Active les boutons d’export
    CN.ui.afficherBloc(CN.el.btnExportPegase, avecPegase);
    CN.el.btnExportPegase.disabled = !avecPegase;
    CN.el.btnExportAnomalies.disabled = false;
    CN.el.btnExportCalcul.disabled = false;
    CN.el.btnExportCalcul.textContent = "Exporter CSV calcul ▾";
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

  // Construit le CSV “calcul”
  CN.app.exports.construireCalculCSV = function (apercu, mappingPegase, config, delim) {
    const colId = mappingPegase?.colId || "N° étudiant";
    const colNom = mappingPegase?.colNom || "Nom";
    const colPrenom = mappingPegase?.colPrenom || "Prénom";

    const colonnesComposantes = typeof CN.affichage.getColonnesComposantesActives === "function"
      ? CN.affichage.getColonnesComposantesActives()
      : [];

    const entetes = [
      "N° étudiant",
      "Nom",
      "Prénom",
      ...colonnesComposantes.map(col => col.label),
      "Note finale (/20)"
    ];

    function fmtBrut(v) {
      const n = CN.data.toNombreFR(v);
      if (!Number.isFinite(n)) return "";

      let s = n.toFixed(3).replace(/\.?0+$/, "");
      if (delim === ";") s = s.replace(".", ",");
      return s;
    }

    function fmtFinal(v) {
      return CN.data.formaterNoteSelonConfig(
        v,
        config,
        delim === ";" ? "," : "."
      );
    }

    const lignes = (apercu?.lignes || []).map(r => {
      const out = {
        "N° étudiant": (r[colId] ?? "").toString(),
        "Nom": (r[colNom] ?? "").toString(),
        "Prénom": (r[colPrenom] ?? "").toString(),
      };

      for (const col of colonnesComposantes) {
        out[col.label] = fmtBrut(r[col.key]);
      }

      out["Note finale (/20)"] = fmtFinal(r["NOTE_FINALE_20"]);

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

  // Formate un nombre pour le CSV détail calcul
  CN.app.exports.formaterNombreDetail = function (valeur, delim = ";") {
    const n = CN.data.toNombreFR(valeur);
    if (!Number.isFinite(n)) return "";

    let s = n.toFixed(4).replace(/\.?0+$/, "");

    if (delim === ";") {
      s = s.replace(".", ",");
    }

    return s;
  };

  // Récupère les résultats d'une composante
  CN.app.exports.getMapResultatComposante = function (composante) {
    if (!composante || !composante.resultat) return new Map();

    if (composante.typeCalcul === "pix") {
      return composante.resultat.parEtudiant instanceof Map
        ? composante.resultat.parEtudiant
        : new Map();
    }

    return composante.resultat.map instanceof Map
      ? composante.resultat.map
      : new Map();
  };

  // Construit uniquement la formule à afficher dans la cellule
  CN.app.exports.construireFormuleDetailComposante = function (comp, id, contribution, delim) {
    const fmt = (v) => CN.app.exports.formaterNombreDetail(v, delim);

    const poids = Number.isFinite(comp?.poids) ? comp.poids : 0;
    const mapComp = CN.app.exports.getMapResultatComposante(comp);
    const item = mapComp.get(id) || null;

    // Si l'étudiant n'a pas de donnée pour cette composante
    if (!item) {
      return "0";
    }

    // PIX : score entre 0 et 1 × pondération
    if (comp.typeCalcul === "pix") {
      const score = Number.isFinite(item.score) ? item.score : 0;
      return `${fmt(score)} × ${fmt(poids)} = ${fmt(contribution)}`;
    }

    // Présences : score sur 5 transformé selon la pondération
    if (comp.typeCalcul === "presence") {
      const score5 = Number.isFinite(item.score5) ? item.score5 : 0;
      return `(${fmt(score5)} / 5) × ${fmt(poids)} = ${fmt(contribution)}`;
    }

    // Composante classique note /20 ou mode libre avec barème source
    if (comp.typeCalcul === "note20") {
      const bareme = CN.utils.normaliserBaremeSource(
        item.baremeSource ?? comp.baremeSource,
        20
      );

      const noteSource = Number.isFinite(item.note20) ? item.note20 : 0;

      return `(${fmt(noteSource)} / ${fmt(bareme)}) × ${fmt(poids)} = ${fmt(contribution)}`;
    }

    return fmt(contribution);
  };

  // Construit le CSV détail calcul
  // Même structure que le CSV calcul, mais les colonnes de composantes contiennent les formules
  CN.app.exports.construireDetailCalculCSV = function (delim = ";") {
    const notes = CN.etat.notes instanceof Map ? CN.etat.notes : new Map();
    const composantesActives = CN.utils.getComposantesActives();
    const apercu = CN.etat.apercu || null;
    const mappingPegase = CN.etat.mappingPegase || {};
    const cfg = CN.etat.config || {};

    const colId = mappingPegase.colId || "N° étudiant";
    const colNom = mappingPegase.colNom || "Nom";
    const colPrenom = mappingPegase.colPrenom || "Prénom";

    const entetes = [
      "N° étudiant",
      "Nom",
      "Prénom",
      ...composantesActives.map(comp => {
        const poids = CN.app.exports.formaterNombreDetail(comp.poids, delim);
        return `${comp.nom || comp.id || "Composante"} (/${poids})`;
      }),
      "Note finale (/20)"
    ];

    const lignes = (apercu?.lignes || []).map(r => {
      const id = (
        r[colId] ??
        r["N° étudiant"] ??
        ""
      ).toString().trim();

      const noteEtudiant = notes.get(id) || null;

      const out = {
        "N° étudiant": id,
        "Nom": (r[colNom] ?? r["Nom"] ?? noteEtudiant?.nom ?? "").toString(),
        "Prénom": (r[colPrenom] ?? r["Prénom"] ?? noteEtudiant?.prenom ?? "").toString(),
      };

      for (const comp of composantesActives) {
        const poids = CN.app.exports.formaterNombreDetail(comp.poids, delim);
        const nomColonne = `${comp.nom || comp.id || "Composante"} (/${poids})`;

        const contribution = Number.isFinite(noteEtudiant?.notesParComposante?.[comp.id])
          ? noteEtudiant.notesParComposante[comp.id]
          : 0;

        out[nomColonne] = CN.app.exports.construireFormuleDetailComposante(
          comp,
          id,
          contribution,
          delim
        );
      }

      out["Note finale (/20)"] = Number.isFinite(noteEtudiant?.noteFinale)
        ? CN.data.formaterNoteSelonConfig(
          noteEtudiant.noteFinale,
          cfg,
          delim === ";" ? "," : "."
        )
        : (r["NOTE_FINALE_20"] ?? "").toString();

      return out;
    });

    return CN.csv.genererCSV(entetes, lignes, delim);
  };

  // Export du CSV détail calcul
  CN.app.exports.exporterDetailCalculCSV = function () {
    if (!CN.etat?.notes || !CN.etat?.apercu) {
      CN.ui.ajouterMessage("warn", "Aucun détail de calcul à exporter. Cliquez d'abord sur « Analyser ».");
      return;
    }

    const delim = CN.etat.mappingPegase?.delimiteur || ";";
    const csv = CN.app.exports.construireDetailCalculCSV(delim);

    const horodatage = CN.app.exports.getHorodatageNomFichier();
    CN.csv.telechargerTexte(`detail_calcul_notes_${horodatage}.csv`, csv);
  };

  // Ferme le menu d'export calcul
  CN.app.exports.fermerMenuExportCalcul = function () {
    const menu = document.getElementById("exportCalculMenu");
    if (menu) menu.remove();

    if (window.__exportCalculOnDocClick) {
      document.removeEventListener("mousedown", window.__exportCalculOnDocClick, true);
      window.__exportCalculOnDocClick = null;
    }

    if (window.__exportCalculOnKeyDown) {
      document.removeEventListener("keydown", window.__exportCalculOnKeyDown, true);
      window.__exportCalculOnKeyDown = null;
    }
  };

  // Construit et affiche le menu sous le bouton "Exporter CSV calcul"
  CN.app.exports.ouvrirMenuExportCalcul = function (btn) {
    CN.app.exports.fermerMenuExportCalcul();

    // Si le menu anomalies est ouvert, on le ferme pour éviter deux menus en même temps
    if (typeof CN.app.exports.fermerMenuExportAnomalies === "function") {
      CN.app.exports.fermerMenuExportAnomalies();
    }

    if (!CN.etat?.apercu) {
      CN.ui.ajouterMessage("warn", "Aucun résultat à exporter. Cliquez d'abord sur « Analyser ».");
      return;
    }

    const rect = btn.getBoundingClientRect();

    const menu = document.createElement("div");
    menu.id = "exportCalculMenu";

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

    function itemHTML(label, action) {
      return `
      <div
        data-action="${action}"
        style="
          padding:10px 12px;
          border-radius:10px;
          cursor:pointer;
          font-weight:900;
          font-size:13px;
          color:#111827;
          line-height:1.25;
          white-space:normal;
        "
        onmouseover="this.style.background='#eff6ff'"
        onmouseout="this.style.background='transparent'"
      >
        ${label}
      </div>
    `;
    }

    menu.innerHTML = `
      ${itemHTML("Calcul simple", "simple")}

      <div style="height:1px;background:#eef2f8;margin:6px 6px;"></div>

      ${itemHTML("Calcul détaillé avec formules", "detail")}
    `;

    document.body.appendChild(menu);

    menu.addEventListener("click", (e) => {
      const target = e.target.closest("[data-action]");
      if (!target) return;

      const action = target.getAttribute("data-action");

      CN.app.exports.fermerMenuExportCalcul();

      if (action === "simple") {
        CN.app.exports.exporterCalculCSV();
        return;
      }

      if (action === "detail") {
        CN.app.exports.exporterDetailCalculCSV();
      }
    });

    window.__exportCalculOnDocClick = (e) => {
      const m = document.getElementById("exportCalculMenu");
      if (!m) return;
      if (m.contains(e.target) || btn.contains(e.target)) return;
      CN.app.exports.fermerMenuExportCalcul();
    };
    document.addEventListener("mousedown", window.__exportCalculOnDocClick, true);

    window.__exportCalculOnKeyDown = (e) => {
      if (e.key === "Escape") CN.app.exports.fermerMenuExportCalcul();
    };
    document.addEventListener("keydown", window.__exportCalculOnKeyDown, true);
  };

  // Bouton calcul : ouvre/ferme le menu
  CN.app.exports.exporterCalcul = function () {
    const menu = document.getElementById("exportCalculMenu");

    if (menu) {
      CN.app.exports.fermerMenuExportCalcul();
      return;
    }

    CN.app.exports.ouvrirMenuExportCalcul(CN.el.btnExportCalcul);
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

  // Presets de configuration

  // Nettoie une composante avant de la mettre dans un preset.
  // On garde uniquement la configuration utile, pas les résultats ni les fichiers importés.
  CN.app.presets.nettoyerComposantePourPreset = function (comp) {
    if (!comp) return null;

    return {
      id: comp.id || "",
      nom: comp.nom || "",
      actif: !!comp.actif,
      poids: Number.isFinite(CN.data.toNombreFR(comp.poids)) ? CN.data.toNombreFR(comp.poids) : 0,
      coefficient: Number.isFinite(CN.data.toNombreFR(comp.coefficient)) ? CN.data.toNombreFR(comp.coefficient) : 1,
      typeCalcul: comp.typeCalcul || "note20",
      baremeSource: Number.isFinite(CN.data.toNombreFR(comp.baremeSource)) ? CN.data.toNombreFR(comp.baremeSource) : null,
      multiFichiers: !!comp.multiFichiers,
      mapping: CN.app.util.copier(comp.mapping || CN.utils.creerMappingVidePourType(comp.typeCalcul)),
      mappingParFichier: CN.app.util.copier(comp.mappingParFichier || {})
    };
  };

  // Normalise une composante chargée depuis un preset.
  // évite de casser l’application si le fichier JSON est incomplet ou ancien.
  CN.app.presets.normaliserComposanteDepuisPreset = function (comp, fallbackIndex) {
    const typeCalcul = ["pix", "presence", "note20"].includes((comp?.typeCalcul || "").toString())
      ? comp.typeCalcul
      : "note20";

    const id = (comp?.id || `comp_${fallbackIndex}`).toString();
    const nom = (comp?.nom || `Composante ${fallbackIndex}`).toString();

    const poids = CN.data.toNombreFR(comp?.poids);
    const coefficient = CN.data.toNombreFR(comp?.coefficient);
    const baremeSource = CN.data.toNombreFR(comp?.baremeSource);

    return {
      id,
      nom,
      actif: comp?.actif !== false,
      poids: Number.isFinite(poids) ? poids : 0,
      coefficient: Number.isFinite(coefficient) && coefficient > 0 ? coefficient : 1,
      typeCalcul,
      baremeSource: typeCalcul === "note20"
        ? CN.utils.normaliserBaremeSource(baremeSource, 20)
        : null,
      multiFichiers: !!comp?.multiFichiers,
      mapping: CN.app.util.copier({
        ...CN.utils.creerMappingVidePourType(typeCalcul),
        ...(comp?.mapping || {})
      }),
      mappingParFichier: CN.app.util.copier(comp?.mappingParFichier || {}),
      resultat: null,
      brut: null
    };
  };

  CN.app.presets.normaliserListeComposantesDepuisPreset = function (liste, fallbackListe) {
    const source = Array.isArray(liste) && liste.length
      ? liste
      : fallbackListe;

    return source
      .filter(Boolean)
      .map((comp, index) => CN.app.presets.normaliserComposanteDepuisPreset(comp, index + 1));
  };

  // Calcule le compteur du mode libre à partir des ids comp_1, comp_2, etc.
  CN.app.presets.calculerCompteurLibre = function (composantesLibres, compteurPreset) {
    let maxId = 0;

    for (const comp of composantesLibres || []) {
      const m = (comp?.id || "").toString().match(/^comp_(\d+)$/);
      if (m) maxId = Math.max(maxId, Number(m[1]));
    }

    const n = Number(compteurPreset);
    return Math.max(Number.isFinite(n) ? n : 0, maxId, composantesLibres?.length || 0);
  };

  // Construit le contenu JSON du preset à partir de l’état actuel.
  CN.app.presets.construirePresetCourant = function () {
    // Avant de sauvegarder, on synchronise l’interface avec CN.etat.
    if (CN.utils.estModeLibre()) {
      CN.app.config.sauverEtatModeLibre();
    } else {
      CN.app.config.syncComposantesDepuisUIClassique();
      CN.app.config.sauverEtatModeClassique();
    }

    CN.etat.config = CN.app.config.calcConfigFromUI();

    const composantesCourantes = (CN.etat.composantes || [])
      .map(CN.app.presets.nettoyerComposantePourPreset)
      .filter(Boolean);

    const composantesClassiques = (CN.etat.composantesClassiques || [])
      .map(CN.app.presets.nettoyerComposantePourPreset)
      .filter(Boolean);

    const composantesLibres = (CN.etat.composantesLibres || [])
      .map(CN.app.presets.nettoyerComposantePourPreset)
      .filter(Boolean);

    return {
      format: "culture-numerique-preset",
      versionPreset: 1,
      appVersion: CN.meta?.version || "",
      dateCreation: new Date().toISOString(),

      donnees: {
        modeSaisie: CN.utils.estModeLibre() ? "libre" : "classique",
        config: CN.app.util.copier(CN.etat.config || {}),
        mappingPegase: CN.app.util.copier(CN.etat.mappingPegase || {}),

        composantes: composantesCourantes,
        composantesClassiques,
        composantesLibres,
        compteurComposantesLibres: CN.etat.compteurComposantesLibres || 0
      }
    };
  };

  // Nettoie le nom choisi par l'utilisateur pour éviter les caractères interdits dans un nom de fichier.
  CN.app.presets.nettoyerNomFichierPreset = function (nom) {
    return (nom ?? "")
      .toString()
      .trim()

      // Si l'utilisateur écrit déjà ".json", on l'enlève pour éviter "preset.json.json".
      .replace(/\.json$/i, "")

      // Caractères interdits dans les noms de fichiers Windows/macOS/Linux.
      .replace(/[\\/:*?"<>|]/g, "")

      // On remplace les espaces multiples par un seul espace.
      .replace(/\s+/g, " ")

      // On limite la longueur pour éviter un nom énorme.
      .slice(0, 80)
      .trim();
  };

  // Construit le nom final du fichier preset.
  // Si aucun nom n'est donné, on garde le nom automatique.
  CN.app.presets.construireNomFichierPreset = function (nomUtilisateur) {
    const horodatage = CN.app.exports.getHorodatageNomFichier();
    const nomNettoye = CN.app.presets.nettoyerNomFichierPreset(nomUtilisateur);

    if (!nomNettoye) {
      return `preset_culture_numerique_${horodatage}.json`;
    }

    return `${nomNettoye}.json`;
  };

  // Télécharge le preset sous forme de fichier JSON.
  CN.app.presets.sauvegarderPreset = function (nomUtilisateur) {
    const preset = CN.app.presets.construirePresetCourant();
    const json = JSON.stringify(preset, null, 2);

    const nomFichier = CN.app.presets.construireNomFichierPreset(nomUtilisateur);

    CN.csv.telechargerTexte(
      nomFichier,
      json,
      "application/json;charset=utf-8"
    );

    CN.ui.ajouterMessage("ok", "Preset sauvegardé. Le fichier JSON pourra être rechargé plus tard.", 3000);
  };

  // Ouvre la fenêtre intégrée à l'application pour saisir le nom du preset.
  CN.app.presets.ouvrirModalNomPreset = function () {
    if (!CN.el.presetNameOverlay || !CN.el.presetNameInput) return;

    CN.el.presetNameInput.value = "";
    CN.ui.afficherBloc(CN.el.presetNameOverlay, true);

    // Petit délai pour que la modal soit affichée avant de mettre le curseur dans le champ.
    setTimeout(() => {
      CN.el.presetNameInput.focus();
    }, 50);
  };

  // Ferme la fenêtre de saisie du nom du preset.
  CN.app.presets.fermerModalNomPreset = function () {
    CN.ui.afficherBloc(CN.el.presetNameOverlay, false);

    if (CN.el.presetNameInput) {
      CN.el.presetNameInput.value = "";
    }
  };

  // Valide le nom saisi puis sauvegarde le preset.
  // Si le champ est vide, le nom automatique sera utilisé.
  CN.app.presets.validerNomPreset = function () {
    const nomUtilisateur = CN.el.presetNameInput?.value || "";

    CN.app.presets.fermerModalNomPreset();
    CN.app.presets.sauvegarderPreset(nomUtilisateur);
  };

  // Vide les fichiers importés, un preset ne contient pas les CSV.
  CN.app.presets.viderFichiersApresChargementPreset = function () {
    if (CN.el.fichierPegase) {
      CN.el.fichierPegase.value = "";
    }

    CN.etat.pegase = null;
    CN.etat.pegaseRempli = null;
    CN.etat.entetesPegase = null;

    CN.etat.fichiersComposantes = {};
    CN.etat.fichiersComposantesClassiques = {};

    CN.ui.setDZText("peg", []);
    CN.app.dropzones.invaliderResultatsAnalyse();
  };

  // Applique dans l’application les données présentes dans le preset.
  CN.app.presets.appliquerPreset = function (preset) {
    if (!preset || preset.format !== "culture-numerique-preset" || !preset.donnees) {
      throw new Error("Le fichier sélectionné n’est pas un preset valide pour cette application.");
    }

    const d = preset.donnees;

    const modeSaisie = d.modeSaisie === "libre" ? "libre" : "classique";

    const configDefaut = {
      modeRemplissage: "ne_rien_ecraser",
      arrondiActif: true,
      arrondiMethode: "classique",
      arrondiPrecision: "centieme",
      modePonderation: "points"
    };

    CN.etat.config = {
      ...configDefaut,
      ...(d.config || {})
    };

    CN.etat.config.modePonderation = CN.app.config.normaliserModePonderation(
      CN.etat.config.modePonderation
    );

    CN.etat.mappingPegase = {
      colId: null,
      colNom: null,
      colPrenom: null,
      colNote: null,
      delimiteur: ";",
      ...(d.mappingPegase || {})
    };

    const classiquesDefaut = CN.utils.creerComposantesModeClassique();
    const libresDefaut = CN.utils.creerComposantesModeLibreParDefaut();

    CN.etat.composantesClassiques = CN.app.presets.normaliserListeComposantesDepuisPreset(
      d.composantesClassiques,
      classiquesDefaut
    );

    CN.etat.composantesLibres = CN.app.presets.normaliserListeComposantesDepuisPreset(
      d.composantesLibres,
      libresDefaut
    );

    CN.etat.compteurComposantesLibres = CN.app.presets.calculerCompteurLibre(
      CN.etat.composantesLibres,
      d.compteurComposantesLibres
    );

    CN.etat.modeSaisie = modeSaisie;
    CN.etat.composantes = CN.app.util.copier(
      modeSaisie === "libre"
        ? CN.etat.composantesLibres
        : CN.etat.composantesClassiques
    );

    // Un preset ne recharge pas les CSV : on repart donc sans fichiers importés.
    CN.app.presets.viderFichiersApresChargementPreset();

    if (CN.el.modePonderation) {
      CN.el.modePonderation.value = CN.etat.config.modePonderation;
    }

    if (CN.el.modeClassique) CN.el.modeClassique.checked = modeSaisie === "classique";
    if (CN.el.modeLibre) CN.el.modeLibre.checked = modeSaisie === "libre";

    CN.app.config.majAffichageModeSaisie();
    CN.app.config.rendreListeComposantesClassiques();
    CN.app.config.rendreListeComposantesLibres();
    CN.app.dropzones.rendreImportsModeClassique();
    CN.app.dropzones.rendreImportsModeLibre();

    CN.app.dropzones.majStatusPills();
    CN.app.dropzones.majBoutonsConfig();

    CN.ui.viderMessages();
    CN.ui.afficherBloc(CN.el.zoneResultats, false);

    CN.app.config.appliquerReglesConfig();

    CN.ui.ajouterMessage(
      "ok",
      "Preset chargé. La configuration a été restaurée, mais les fichiers CSV doivent être réimportés.",
      4000
    );
  };

  // Lit le fichier JSON choisi par l’utilisateur.
  CN.app.presets.chargerPresetDepuisFichier = async function (file) {
    if (!file) return;

    const texte = await CN.csv.lireFichierTexte(file);
    let preset = null;

    try {
      preset = JSON.parse(texte);
    } catch (_) {
      throw new Error("Impossible de lire le preset : le fichier JSON est invalide.");
    }

    CN.app.presets.appliquerPreset(preset);
  };

  // Main (reset, bind, init)

  // Onglet dans la zone des résultats
  // - "apercu" affiche le tableau principal
  // - "anomalies" affiche le tableau des anomalies
  CN.app.main.activerOngletResultats = function (onglet) {
    const cible = onglet === "anomalies" ? "anomalies" : "apercu";

    const tabs = [
      {
        nom: "apercu",
        bouton: CN.el.resultTabApercu,
        panel: CN.el.panelApercu
      },
      {
        nom: "anomalies",
        bouton: CN.el.resultTabAnomalies,
        panel: CN.el.panelAnomalies
      }
    ];

    for (const item of tabs) {
      const actif = item.nom === cible;

      if (item.bouton) {
        item.bouton.classList.toggle("active", actif);
        item.bouton.setAttribute("aria-selected", actif ? "true" : "false");
      }

      if (item.panel) {
        item.panel.classList.toggle("active", actif);
      }
    }

    // On affiche uniquement la pagination du tableau actif.
    if (CN.el.paginationApercu) {
      CN.ui.afficherBloc(CN.el.paginationApercu, cible === "apercu");
    }

    if (CN.el.paginationAnomalies) {
      CN.ui.afficherBloc(CN.el.paginationAnomalies, cible === "anomalies");
    }
  };

  // Réinitialisation (remet l’état à zéro)
  CN.app.main.reinitialiser = function () {
    // On garde le mode actuel
    const modeCourant = CN.utils.estModeLibre() ? "libre" : "classique";

    const composantesClassiquesDefaut = CN.utils.creerComposantesModeClassique();
    const composantesLibresDefaut = CN.utils.creerComposantesModeLibreParDefaut();

    CN.etat.modeSaisie = modeCourant;

    // Réinitialisation UNIQUEMENT du mode courant
    if (modeCourant === "libre") {
      // On remet à zéro seulement le mode libre
      CN.etat.composantesLibres = CN.app.util.copier(composantesLibresDefaut);
      CN.etat.composantes = CN.app.util.copier(composantesLibresDefaut);
      CN.etat.compteurComposantesLibres = 2;
      CN.etat.fichiersComposantes = {};
      // On ne touche pas au mode classique
    } else {
      // On remet à zéro seulement le mode classique
      CN.etat.composantesClassiques = CN.app.util.copier(composantesClassiquesDefaut);
      CN.etat.composantes = CN.app.util.copier(composantesClassiquesDefaut);
      CN.etat.fichiersComposantesClassiques = {};
    }

    // Éléments communs aux 2 modes

    // Données importées
    CN.etat.pegase = null;

    // Mapping PEGASE commun
    CN.etat.mappingPegase = {
      colId: null,
      colNom: null,
      colPrenom: null,
      colNote: null,
      delimiteur: ";"
    };

    // En-têtes mémorisés
    CN.etat.entetesPegase = null;

    // Résultats calculés
    CN.etat.notes = null;
    CN.etat.pegaseRempli = null;
    CN.etat.anomalies = null;
    CN.etat.anomaliesParId = null;
    CN.etat.apercu = null;
    CN.etat.tableAnomaliesData = null;
    CN.etat.modeSansPegase = false;
    CN.etat.analyseDejaLancee = false;

    // Reset input fichier PEGASE
    if (CN.el.fichierPegase) {
      CN.el.fichierPegase.value = "";
    }

    // Reset textes des dropzones
    CN.ui.setDZText("peg", []);

    // Reset UI
    CN.app.modal.fermerModalMapping();
    CN.app.modal.fermerParamCalcul();
    CN.app.modal.fermerModalReglagesComposante();
    CN.app.presets.fermerModalNomPreset();

    CN.el.recherche.value = "";
    CN.el.filtreAnomalies.value = "tous";

    if (CN.el.rechercheAnomalies) {
      CN.el.rechercheAnomalies.value = "";
    }

    if (CN.el.filtreTypeAnomalies) {
      CN.el.filtreTypeAnomalies.innerHTML = `<option value="tous" selected>Tous les types</option>`;
      CN.el.filtreTypeAnomalies.value = "tous";
    }

    // On recoche le bon mode
    if (CN.el.modeClassique) CN.el.modeClassique.checked = (modeCourant === "classique");
    if (CN.el.modeLibre) CN.el.modeLibre.checked = (modeCourant === "libre");

    // Re-rendu
    CN.app.config.majAffichageModeSaisie();
    CN.app.config.rendreListeComposantesClassiques();
    CN.app.config.rendreListeComposantesLibres();
    CN.app.dropzones.rendreImportsModeClassique();
    CN.app.dropzones.rendreImportsModeLibre();

    CN.app.dropzones.majStatusPills();
    CN.ui.viderMessages();
    CN.ui.afficherBloc(CN.el.zoneResultats, false);

    CN.ui.ajouterMessage("info", "Réinitialisation effectuée.", 2500);
    CN.app.dropzones.majBoutonsConfig();

    CN.ui.afficherBloc(CN.el.btnExportPegase, true);
    CN.el.btnExportPegase.disabled = true;
    CN.el.btnExportAnomalies.disabled = true;
    CN.el.btnExportCalcul.disabled = true;

    if (CN.el.btnExportDetailCalcul) CN.el.btnExportDetailCalcul.disabled = true;

    CN.app.config.appliquerReglesConfig();
  };

  // Alerte Safari (compatibilité fichiers)
  CN.app.main.detectSafari = function () {
    const ua = navigator.userAgent || "";
    const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg/.test(ua);
    CN.ui.afficherBloc(CN.el.safariWarning, isSafari);
  };

  // Gestion des événements (clics / input / clavier)
  CN.app.main.bind = function () {
    // Changement config classique
    if (CN.el.classicComposantesList) {
      const onClassicConfigChange = (e) => {
        const target = e.target;
        if (!target) return;

        if (
          target.matches('[data-role="classic-active"]') ||
          target.matches('[data-role="classic-weight"]')
        ) {
          CN.app.config.appliquerReglesConfig();
        }
      };

      CN.el.classicComposantesList.addEventListener("change", onClassicConfigChange);
      CN.el.classicComposantesList.addEventListener("input", onClassicConfigChange);
    }

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
    CN.el.btnExportCalcul.addEventListener("click", CN.app.exports.exporterCalcul);

    // Onglets des tableaux de résultats
    if (CN.el.resultTabApercu) {
      CN.el.resultTabApercu.addEventListener("click", () => {
        CN.app.main.activerOngletResultats("apercu");
      });
    }

    if (CN.el.resultTabAnomalies) {
      CN.el.resultTabAnomalies.addEventListener("click", () => {
        CN.app.main.activerOngletResultats("anomalies");
      });
    }

    // Bouton paramètres avancés
    if (CN.el.btnOpenParamCalcul) {
      CN.el.btnOpenParamCalcul.addEventListener("click", CN.app.modal.ouvrirParamCalcul);
    }

    if (CN.el.btnSettingsClose) {
      CN.el.btnSettingsClose.addEventListener("click", CN.app.modal.fermerParamCalcul);
    }
    if (CN.el.btnSettingsCancel) {
      CN.el.btnSettingsCancel.addEventListener("click", CN.app.modal.fermerParamCalcul);
    }
    if (CN.el.btnSettingsSave) {
      CN.el.btnSettingsSave.addEventListener("click", () => CN.app.modal.enregistrerParamCalcul());
    }

    [CN.el.paramArrondiActif, CN.el.paramArrondiMethode, CN.el.paramArrondiPrecision].forEach(x => {
      if (!x) return;
      x.addEventListener("change", CN.app.modal.majPreviewParamCalcul);
      x.addEventListener("input", CN.app.modal.majPreviewParamCalcul);
    });

    // Bouton mapping PEGASE
    if (CN.el.btnCfgPegase) {
      CN.el.btnCfgPegase.addEventListener("click", () => {
        CN.app.modal.ouvrirModalMappingPegase().catch(e => CN.ui.ajouterMessage("danger", e.message));
      });
    }

    if (CN.el.btnClearPegase) {
      CN.el.btnClearPegase.addEventListener("click", CN.app.dropzones.viderImportPegase);
    }

    // Mapping composantes en mode classique
    if (CN.el.classicImportsCards) {
      CN.el.classicImportsCards.addEventListener("click", (e) => {
        const btnCfg = e.target.closest('[data-action="cfg-comp"]');
        if (btnCfg) {
          CN.app.modal.ouvrirModalMappingComposante(btnCfg.dataset.compId)
            .catch(err => CN.ui.ajouterMessage("danger", err.message));
          return;
        }

        const btnClear = e.target.closest('[data-action="clear-comp"]');
        if (btnClear) {
          CN.app.dropzones.viderImportComposante(
            btnClear.dataset.compId,
            btnClear.dataset.compMode
          );
        }
      });
    }

    // Modal : fermer / annuler / enregistrer
    CN.el.btnModalClose.addEventListener("click", CN.app.modal.fermerModalMapping);
    CN.el.btnModalCancel.addEventListener("click", CN.app.modal.fermerModalMapping);
    CN.el.btnModalSave.addEventListener("click", () => CN.app.modal.enregistrerModalMapping());

    if (CN.el.btnCompSettingsClose) {
      CN.el.btnCompSettingsClose.addEventListener("click", CN.app.modal.fermerModalReglagesComposante);
    }

    if (CN.el.btnCompSettingsCancel) {
      CN.el.btnCompSettingsCancel.addEventListener("click", CN.app.modal.fermerModalReglagesComposante);
    }

    if (CN.el.btnCompSettingsSave) {
      CN.el.btnCompSettingsSave.addEventListener("click", CN.app.modal.enregistrerModalReglagesComposante);
    }

    if (CN.el.btnCompSettingsDelete) {
      CN.el.btnCompSettingsDelete.addEventListener("click", CN.app.modal.supprimerDepuisModalReglagesComposante);
    }

    // Clic sur le fond => ferme
    CN.el.modalOverlay.addEventListener("click", (e) => {
      if (e.target === CN.el.modalOverlay) CN.app.modal.fermerModalMapping();
    });

    if (CN.el.compSettingsOverlay) {
      CN.el.compSettingsOverlay.addEventListener("click", (e) => {
        if (e.target === CN.el.compSettingsOverlay) {
          CN.app.modal.fermerModalReglagesComposante();
        }
      });
    }

    if (CN.el.settingsOverlay) {
      CN.el.settingsOverlay.addEventListener("click", (e) => {
        if (e.target === CN.el.settingsOverlay) CN.app.modal.fermerParamCalcul();
      });
    }

    // Touche ESC => ferme la modal si elle est ouverte
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;

      if (CN.el.presetNameOverlay && !CN.el.presetNameOverlay.classList.contains("bloc-cache")) {
        CN.app.presets.fermerModalNomPreset();
        return;
      }

      if (CN.el.aboutOverlay && !CN.el.aboutOverlay.classList.contains("bloc-cache")) {
        CN.ui.afficherBloc(CN.el.aboutOverlay, false);
        return;
      }

      if (CN.el.settingsOverlay && !CN.el.settingsOverlay.classList.contains("bloc-cache")) {
        CN.app.modal.fermerParamCalcul();
        return;
      }

      if (CN.el.modalOverlay && !CN.el.modalOverlay.classList.contains("bloc-cache")) {
        CN.app.modal.fermerModalMapping();
      }

      if (CN.el.compSettingsOverlay && !CN.el.compSettingsOverlay.classList.contains("bloc-cache")) {
        CN.app.modal.fermerModalReglagesComposante();
        return;
      }
    });

    if (CN.el.modePonderation) {
      CN.el.modePonderation.addEventListener("change", () => {
        CN.etat.config.modePonderation = CN.app.config.normaliserModePonderation(CN.el.modePonderation.value);
        CN.app.config.appliquerReglesConfig();
      });
    }

    // Switch mode
    if (CN.el.modeClassique) {
      CN.el.modeClassique.addEventListener("change", () => {
        if (CN.el.modeClassique.checked) {
          CN.app.config.basculerModeSaisie("classique");
        }
      });
    }

    if (CN.el.modeLibre) {
      CN.el.modeLibre.addEventListener("change", () => {
        if (CN.el.modeLibre.checked) {
          CN.app.config.basculerModeSaisie("libre");
        }
      });
    }

    // Boutons mode libre
    if (CN.el.btnAddComposante) {
      CN.el.btnAddComposante.addEventListener("click", CN.app.config.ajouterComposanteLibre);
    }

    if (CN.el.btnOpenParamCalculLibre) {
      CN.el.btnOpenParamCalculLibre.addEventListener("click", CN.app.modal.ouvrirParamCalcul);
    }

    // Presets de configuration
    if (CN.el.btnSavePreset) {
      CN.el.btnSavePreset.addEventListener("click", CN.app.presets.ouvrirModalNomPreset);
    }

    // Modal nom du preset
    if (CN.el.btnPresetNameClose) {
      CN.el.btnPresetNameClose.addEventListener("click", CN.app.presets.fermerModalNomPreset);
    }

    if (CN.el.btnPresetNameCancel) {
      CN.el.btnPresetNameCancel.addEventListener("click", CN.app.presets.fermerModalNomPreset);
    }

    if (CN.el.btnPresetNameSave) {
      CN.el.btnPresetNameSave.addEventListener("click", CN.app.presets.validerNomPreset);
    }

    if (CN.el.presetNameInput) {
      CN.el.presetNameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          CN.app.presets.validerNomPreset();
        }
      });
    }

    if (CN.el.presetNameOverlay) {
      CN.el.presetNameOverlay.addEventListener("click", (e) => {
        if (e.target === CN.el.presetNameOverlay) {
          CN.app.presets.fermerModalNomPreset();
        }
      });
    }

    if (CN.el.btnLoadPreset && CN.el.presetFileInput) {
      CN.el.btnLoadPreset.addEventListener("click", () => {
        CN.el.presetFileInput.click();
      });
    }

    if (CN.el.presetFileInput) {
      CN.el.presetFileInput.addEventListener("change", () => {
        const file = CN.el.presetFileInput.files?.[0] || null;

        CN.app.presets.chargerPresetDepuisFichier(file)
          .catch(e => {
            CN.ui.ajouterMessage("danger", e.message);
            console.error(e);
          })
          .finally(() => {
            CN.el.presetFileInput.value = "";
          });
      });
    }
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
    if (!CN.etat.modeSaisie) {
      CN.etat.modeSaisie = "classique";
    }

    if (!Array.isArray(CN.etat.composantes) || !CN.etat.composantes.length) {
      CN.etat.composantes = CN.utils.creerComposantesModeClassique();
    }

    if (!Array.isArray(CN.etat.composantesClassiques) || !CN.etat.composantesClassiques.length) {
      CN.etat.composantesClassiques = CN.app.util.copier(CN.etat.composantes);
    }

    CN.app.config.ensureModeClassiqueDynamicUI();

    // Par défaut : pas d’export tant qu’on n’a pas analysé
    CN.el.btnExportPegase.disabled = true;
    CN.el.btnExportAnomalies.disabled = true;
    CN.el.btnExportCalcul.disabled = true;
    CN.el.btnExportCalcul.textContent = "Exporter CSV calcul ▾";
    CN.el.btnExportAnomalies.textContent = "Exporter CSV anomalies ▾";

    // Textes de dropzones
    CN.ui.setDZText("peg", []);

    CN.app.config.majAffichageModeSaisie();
    CN.app.config.rendreListeComposantesClassiques();
    CN.app.config.rendreListeComposantesLibres();
    CN.app.dropzones.rendreImportsModeClassique();
    CN.app.dropzones.rendreImportsModeLibre();

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