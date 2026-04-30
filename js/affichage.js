/*
   affichage.js - Affichage des résultats
   - construit le tableau "aperçu"
   - remplit les tableaux HTML
   - applique les filtres (recherche + anomalies)
   - génère le bloc "Résumé"
 */
(function () {
  "use strict";

  const CN = window.CN;
  CN.affichage = CN.affichage || {};

  const NB_LIGNES_PAR_PAGE = 50;

  function getEtatPagination(cle) {
    CN.etat.pagination = CN.etat.pagination || {};
    CN.etat.pagination[cle] = CN.etat.pagination[cle] || {
      page: 1,
      parPage: NB_LIGNES_PAR_PAGE
    };

    const etat = CN.etat.pagination[cle];

    if (!Number.isFinite(etat.page) || etat.page < 1) {
      etat.page = 1;
    }

    if (!Number.isFinite(etat.parPage) || etat.parPage < 1) {
      etat.parPage = NB_LIGNES_PAR_PAGE;
    }

    return etat;
  }

  CN.affichage.resetPagination = function (cle) {
    const etat = getEtatPagination(cle);
    etat.page = 1;
  };

  function getPagesAffichees(page, nbPages) {
    if (nbPages <= 7) {
      return Array.from({ length: nbPages }, (_, i) => i + 1);
    }

    const pages = [1];

    if (page > 3) {
      pages.push("...");
    }

    const debut = Math.max(2, page - 1);
    const fin = Math.min(nbPages - 1, page + 1);

    for (let p = debut; p <= fin; p++) {
      pages.push(p);
    }

    if (page < nbPages - 2) {
      pages.push("...");
    }

    pages.push(nbPages);

    return pages;
  }

  function remplirPaginationHTML(paginationEl, cle, totalLignes, onChange) {
    if (!paginationEl) return;

    const etat = getEtatPagination(cle);
    const nbPages = Math.max(1, Math.ceil(totalLignes / etat.parPage));

    etat.page = Math.min(Math.max(1, etat.page), nbPages);

    if (totalLignes === 0) {
      paginationEl.innerHTML = `
        <div class="table-pagination-info">Aucune ligne à afficher</div>
      `;
      return;
    }

    const debut = ((etat.page - 1) * etat.parPage) + 1;
    const fin = Math.min(etat.page * etat.parPage, totalLignes);

    const pages = getPagesAffichees(etat.page, nbPages);

    const boutonsPages = pages.map(p => {
      if (p === "...") {
        return `<span class="table-page-ellipsis">…</span>`;
      }

      return `
        <button
          type="button"
          class="table-page-btn ${p === etat.page ? "active" : ""}"
          data-page="${p}"
        >
          ${p}
        </button>
      `;
    }).join("");

    paginationEl.innerHTML = `
      <div class="table-pagination-info">
        Lignes ${debut}-${fin} sur ${totalLignes} - page ${etat.page}/${nbPages}
      </div>

      <div class="table-pagination-actions">
        <button
          type="button"
          class="table-page-btn"
          data-page="prev"
          ${etat.page <= 1 ? "disabled" : ""}
        >
          Précédent
        </button>

        ${boutonsPages}

        <button
          type="button"
          class="table-page-btn"
          data-page="next"
          ${etat.page >= nbPages ? "disabled" : ""}
        >
          Suivant
        </button>
      </div>
    `;

    paginationEl.querySelectorAll("[data-page]").forEach(btn => {
      btn.addEventListener("click", () => {
        const action = btn.getAttribute("data-page");

        if (action === "prev") {
          etat.page = Math.max(1, etat.page - 1);
        } else if (action === "next") {
          etat.page = Math.min(nbPages, etat.page + 1);
        } else {
          const p = Number(action);
          if (Number.isFinite(p)) {
            etat.page = Math.min(Math.max(1, p), nbPages);
          }
        }

        if (typeof onChange === "function") {
          onChange();
        }
      });
    });
  }

  CN.affichage.remplirTableHTMLPagination = function (
    tableHead,
    tableBody,
    paginationEl,
    clePagination,
    entetes,
    lignes,
    labels,
    onChange
  ) {
    const toutesLesLignes = Array.isArray(lignes) ? lignes : [];
    const etat = getEtatPagination(clePagination);

    const nbPages = Math.max(1, Math.ceil(toutesLesLignes.length / etat.parPage));
    etat.page = Math.min(Math.max(1, etat.page), nbPages);

    const debut = (etat.page - 1) * etat.parPage;
    const fin = debut + etat.parPage;

    const lignesPage = toutesLesLignes.slice(debut, fin);

    CN.affichage.remplirTableHTML(
      tableHead,
      tableBody,
      entetes,
      lignesPage,
      labels
    );

    remplirPaginationHTML(
      paginationEl,
      clePagination,
      toutesLesLignes.length,
      onChange
    );
  };

  function libelleNotePegase(colNote) {
    const raw = (colNote ?? "").toString().trim();
    if (!raw) return "Note";

    const norm = CN.data.nettoyerTexte(raw);

    const m = norm.match(/NOTE[_\s-]*SESSION[_\s-]*(\d+)/);
    if (m && m[1]) return `Note session ${m[1]}`;

    if (norm.includes("NOTE")) return `Note (${raw})`;

    return raw;
  }

  function libelleModeRemplissage(mode) {
    const m = (mode ?? "").toString();

    if (m === "ecraser_systematiquement") {
      return "Écraser systématiquement";
    }
    if (m === "si_nouvelle_superieure") {
      return "Remplacer seulement si la nouvelle note est supérieure";
    }
    if (m === "si_ancienne_lt10_et_nouvelle_gt10") {
      return "Remplacer seulement si l'ancienne note est < 10 et la nouvelle > 10";
    }
    return "Ne rien écraser";
  }

  function libelleMethodeArrondi(methode) {
    const m = (methode ?? "").toString();
    if (m === "superieur") return "Arrondi au supérieur";
    if (m === "inferieur") return "Arrondi à l’inférieur";
    return "Arrondi classique";
  }

  function libellePrecisionArrondi(precision) {
    const p = (precision ?? "").toString();
    if (p === "entier") return "à l’entier";
    if (p === "dixieme") return "au dixième";
    return "au centième";
  }

  function formaterNoteBruteAffichage(valeur) {
    const n = CN.data.toNombreFR(valeur);
    if (!Number.isFinite(n)) return "";

    // enlève les zéros inutiles à la fin
    return n.toFixed(3).replace(/\.?0+$/, "").replace(".", ",");
  }

  function formaterNoteFinaleAffichage(valeur, config) {
    return CN.data.formaterNoteSelonConfig(valeur, config, ",");
  }

  function formaterBaremeAffichage(valeur) {
    const n = CN.data.toNombreFR(valeur);
    if (!Number.isFinite(n)) return "0";

    return n.toFixed(3).replace(/\.?0+$/, "").replace(".", ",");
  }

  function getComposantesActivesApercu() {
    const comps = Array.isArray(CN.etat.composantes) ? CN.etat.composantes : [];
    return comps.filter(c => c && c.actif);
  }

  function getCleColonneComposante(comp) {
    const raw = (comp?.id || comp?.nom || "composante")
      .toString()
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_");

    return `NOTE_COMP_${raw}`;
  }

  function getLibelleColonneComposante(comp) {
    const nom = (comp?.nom || comp?.id || "Composante").toString().trim();
    const poids = formaterBaremeAffichage(comp?.poids);
    return `${nom} (/${poids})`;
  }

  function getValeurNoteComposantePourApercu(noteEtudiant, comp) {
    if (!noteEtudiant || !comp) return "";

    const noteDynamique = noteEtudiant.notesParComposante?.[comp.id];
    if (Number.isFinite(noteDynamique)) {
      return formaterNoteBruteAffichage(noteDynamique);
    }

    return "";
  }

  function construireColonnesComposantesApercu() {
    return getComposantesActivesApercu().map(comp => ({
      comp,
      key: getCleColonneComposante(comp),
      label: getLibelleColonneComposante(comp)
    }));
  }

  // Expose les colonnes dynamiques pour les autres modules
  CN.affichage.getColonnesComposantesActives = function () {
    return construireColonnesComposantesApercu();
  };

  /*
     Construire les données du tableau "aperçu"
     - entetes : ordre des colonnes à afficher
     - lignes  : données de chaque étudiant
     - labels  : noms des colonnes
  */
  CN.affichage.rendreTableApercu = function (pegase, mappingPegase, notes, anomaliesParId, config) {
    const avecPegase = !!(
      pegase &&
      Array.isArray(pegase.lignes) &&
      mappingPegase &&
      mappingPegase.colId &&
      mappingPegase.colNom &&
      mappingPegase.colPrenom &&
      mappingPegase.colNote
    );

    const colonnesComposantes = construireColonnesComposantesApercu();

    // CAS 1 : SANS PEGASE
    if (!avecPegase) {
      const entetes = ["N° étudiant", "Nom", "Prénom"];

      for (const col of colonnesComposantes) {
        entetes.push(col.key);
      }

      entetes.push("NOTE_FINALE_20");

      const labels = {
        "N° étudiant": "N° étudiant",
        "Nom": "Nom",
        "Prénom": "Prénom",
        "NOTE_FINALE_20": "Note finale (/20)"
      };

      for (const col of colonnesComposantes) {
        labels[col.key] = col.label;
      }

      const ids = Array.from(notes.keys());

      const lignes = ids.map((id) => {
        const n = notes.get(id) || null;
        const nbAno = anomaliesParId.get(id)?.length || 0;

        const base = {
          "N° étudiant": id,
          "Nom": n?.nom || "",
          "Prénom": n?.prenom || "",
          "ANOMALIES": nbAno ? String(nbAno) : ""
        };

        for (const col of colonnesComposantes) {
          base[col.key] = getValeurNoteComposantePourApercu(n, col.comp);
        }

        base["NOTE_FINALE_20"] = formaterNoteFinaleAffichage(n?.noteFinale, config);

        return base;
      });

      return { entetes, lignes, labels };
    }

    // CAS 2 : AVEC PEGASE
    const entetes = [
      mappingPegase.colId,
      mappingPegase.colNom,
      mappingPegase.colPrenom,
      mappingPegase.colNote
    ];

    for (const col of colonnesComposantes) {
      entetes.push(col.key);
    }

    entetes.push("NOTE_FINALE_20", "STATUT");

    const labels = {};
    labels[mappingPegase.colId] = "N° étudiant";
    labels[mappingPegase.colNom] = "Nom";
    labels[mappingPegase.colPrenom] = "Prénom";
    labels[mappingPegase.colNote] = libelleNotePegase(mappingPegase.colNote);

    for (const col of colonnesComposantes) {
      labels[col.key] = col.label;
    }

    labels["NOTE_FINALE_20"] = "Note finale (/20)";
    labels["STATUT"] = "Statut";

    const pegById = new Map();
    for (const r of pegase.lignes) {
      const id = (r[mappingPegase.colId] ?? "").toString().trim();
      if (id && !pegById.has(id)) pegById.set(id, r);
    }

    const ids = [];
    const seen = new Set();

    for (const r of pegase.lignes) {
      const id = (r[mappingPegase.colId] ?? "").toString().trim();
      if (id && !seen.has(id)) {
        ids.push(id);
        seen.add(id);
      }
    }

    for (const id of notes.keys()) {
      if (id && !seen.has(id)) {
        ids.push(id);
        seen.add(id);
      }
    }

    const lignes = ids.map((id) => {
      const rPeg = pegById.get(id) || null;
      const n = notes.get(id) || null;
      const nbAno = anomaliesParId.get(id)?.length || 0;

      const nom = rPeg ? (rPeg[mappingPegase.colNom] ?? "") : (n?.nom || "");
      const prenom = rPeg ? (rPeg[mappingPegase.colPrenom] ?? "") : (n?.prenom || "");

      const base = {
        [mappingPegase.colId]: id,
        [mappingPegase.colNom]: nom,
        [mappingPegase.colPrenom]: prenom,
        [mappingPegase.colNote]: rPeg ? (rPeg[mappingPegase.colNote] ?? "") : "",
        STATUT: rPeg ? "PEGASE" : "Hors PEGASE",
        ANOMALIES: nbAno ? String(nbAno) : ""
      };

      for (const col of colonnesComposantes) {
        base[col.key] = getValeurNoteComposantePourApercu(n, col.comp);
      }

      base["NOTE_FINALE_20"] = formaterNoteFinaleAffichage(n?.noteFinale, config);

      return base;
    });

    return { entetes, lignes, labels };
  };

  /*
     Remplir un tableau HTML
  */
  CN.affichage.remplirTableHTML = function (tableHead, tableBody, entetes, lignes, labels) {
    tableHead.innerHTML = "";
    tableBody.innerHTML = "";

    // En-têtes
    const trh = document.createElement("tr");
    for (const h of entetes) {
      const th = document.createElement("th");
      th.textContent = (labels && labels[h]) ? labels[h] : h;
      trh.appendChild(th);
    }
    tableHead.appendChild(trh);

    // Lignes
    for (const l of lignes) {
      const tr = document.createElement("tr");
      for (const h of entetes) {
        const td = document.createElement("td");
        td.textContent = (l[h] ?? "").toString();
        tr.appendChild(td);
      }
      tableBody.appendChild(tr);
    }
  };

  /*
     Filtrer le tableau "aperçu"
     - recherche texte (numéro étudiant/nom/prénom)
     - filtre anomalies (tous / avec / sans)
  */
  CN.affichage.filtrerApercu = function (apercu, options = {}) {
    if (!apercu) return;

    if (options.resetPage) {
      CN.affichage.resetPagination("apercu");
    }

    const q = (CN.el.recherche?.value ?? "").toString().trim().toUpperCase();
    const filtre = CN.el.filtreAnomalies?.value || "tous";

    const entetes = apercu.entetes;

    const lignes = apercu.lignes.filter((r) => {
      // Recherche (sur les 3 premières colonnes : numéro étudiant, nom, prénom)
      const txt = `${r[entetes[0]]} ${r[entetes[1]]} ${r[entetes[2]]}`.toUpperCase();
      const matchQ = !q || txt.includes(q);

      // Filtre anomalies
      const a = (r["ANOMALIES"] ?? "").toString().trim();
      const aOui = a !== "" && a !== "0";

      const matchA =
        filtre === "tous" ? true :
          filtre === "avec" ? aOui :
            filtre === "sans" ? !aOui :
              true;

      return matchQ && matchA;
    });

    CN.affichage.remplirTableHTMLPagination(
      CN.el.tableApercuHead,
      CN.el.tableApercuBody,
      CN.el.paginationApercu,
      "apercu",
      entetes,
      lignes,
      apercu.labels,
      () => CN.affichage.filtrerApercu(apercu)
    );
  };

  /*
   Remplit la liste des types d'anomalies disponibles
   - La liste est générée à partir des anomalies réellement présentes
   - Exemple : COMPOSANTE_MANQUANTE, INCONNU_PEGASE, NUM_ETUDIANT_INVALIDE
*/
  CN.affichage.remplirFiltreTypesAnomalies = function (tableAno) {
    const select = CN.el.filtreTypeAnomalies;
    if (!select || !tableAno) return;

    const ancienneValeur = select.value || "tous";

    const types = Array.from(
      new Set(
        (tableAno.lignes || [])
          .map(r => (r["Type"] ?? "").toString().trim())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b, "fr", { sensitivity: "base" }));

    select.innerHTML = "";

    const optTous = document.createElement("option");
    optTous.value = "tous";
    optTous.textContent = "Tous les types";
    select.appendChild(optTous);

    for (const type of types) {
      const opt = document.createElement("option");
      opt.value = type;
      opt.textContent = type;
      select.appendChild(opt);
    }

    const valeurExiste = Array.from(select.options).some(opt => opt.value === ancienneValeur);
    select.value = valeurExiste ? ancienneValeur : "tous";
  };

  /*
     Filtrer le tableau "anomalies"
     - recherche texte sur toutes les colonnes affichées
     - filtre par type d'anomalie
  */
  CN.affichage.filtrerAnomalies = function (tableAno, options = {}) {
    if (!tableAno) return;

    if (options.resetPage) {
      CN.affichage.resetPagination("anomalies");
    }

    const q = CN.data.nettoyerTexte(CN.el.rechercheAnomalies?.value || "");
    const typeChoisi = (CN.el.filtreTypeAnomalies?.value || "tous").toString();

    const entetes = tableAno.entetes || [];
    const labels = tableAno.labels || null;

    const lignes = (tableAno.lignes || []).filter((r) => {
      const texteLigne = entetes
        .map(h => r[h] ?? "")
        .join(" ");

      const txt = CN.data.nettoyerTexte(texteLigne);

      const matchRecherche = !q || txt.includes(q);

      const typeLigne = (r["Type"] ?? "").toString().trim();
      const matchType = typeChoisi === "tous" || typeLigne === typeChoisi;

      return matchRecherche && matchType;
    });

    CN.affichage.remplirTableHTMLPagination(
      CN.el.tableAnomaliesHead,
      CN.el.tableAnomaliesBody,
      CN.el.paginationAnomalies,
      "anomalies",
      entetes,
      lignes,
      labels,
      () => CN.affichage.filtrerAnomalies(tableAno)
    );
  };

  /*
     Construire le bloc "Résumé"
     - stats : infos calculées dans app.js
     - config : paramètres d'arrondi + mode PEGASE
   */
  CN.affichage.construireResume = function (stats, config) {
    const wrap = document.createElement("div");
    wrap.className = "ligne";

    const composantes = Array.isArray(stats?.composantes) ? stats.composantes : [];
    const modeCoeff = (config?.modePonderation || "points") === "coefficients";

    const compResume = composantes.length
      ? composantes
        .map(c => {
          if (modeCoeff) {
            return `${c.nom}=coef ${formaterBaremeAffichage(c.coefficient)} → /${formaterBaremeAffichage(c.poids)}`;
          }

          return `${c.nom}=${formaterBaremeAffichage(c.poids)}`;
        })
        .join(" ; ")
      : "Aucune";

    const detailsComposantes = composantes.length
      ? composantes.map(c => {
        const infoBaremeSource =
          c.typeCalcul === "note20" && Number.isFinite(CN.data.toNombreFR(c.baremeSource))
            ? ` ; barème source /${formaterBaremeAffichage(c.baremeSource)}`
            : "";

        const infoPonderation = modeCoeff
          ? `coef ${formaterBaremeAffichage(c.coefficient)} → /${formaterBaremeAffichage(c.poids)}`
          : `/${formaterBaremeAffichage(c.poids)}`;

        return `${c.nom} (${infoPonderation}${infoBaremeSource}) : ${c.nbValides} valides - invalides : ${c.nbInvalides} - fichiers : ${c.nbFichiers}<br/>`;
      }).join("")
      : "Aucune composante active<br/>";

    wrap.innerHTML = `
    <div class="alerte info" style="flex:1">
      <b>Résumé</b><br/>
      Pondération : <b>${modeCoeff ? "Coefficients" : "Points sur /20"}</b><br/>
      Composantes : <b>${compResume}</b> (note finale sur /20)<br/>
      Arrondi : <b>${config.arrondiActif === false ? "Désactivé (note brute)" : `${libelleMethodeArrondi(config.arrondiMethode)} ${libellePrecisionArrondi(config.arrondiPrecision)}`}</b><br/>
      ${stats.avecPegase ? `Mode PEGASE : <b>${libelleModeRemplissage(config.modeRemplissage)}</b><br/>` : ``}
      <br/>

      ${stats.avecPegase ? `PEGASE : ${stats.pegaseLignes} lignes<br/>` : ``}
      ${detailsComposantes}
      <br/>
      ${stats.avecPegase ? `Écritures PEGASE : <b>${stats.nbEcrits}</b> - ignorées : ${stats.nbIgnores} - ABI : ${stats.nbABI}<br/>` : ``}
      Anomalies : <b>${stats.nbAnomalies}</b>
    </div>
  `;

    return wrap;
  };
})();