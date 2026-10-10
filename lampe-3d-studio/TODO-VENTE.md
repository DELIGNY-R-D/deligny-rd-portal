# Lampe 3D Studio — étapes jusqu'à la vente

Remis à plat le 30/09/2026. **Produit : coque imprimée par DELIGNY R&D + kit LED USB 5 V type
Kit 001, assemblés et vendus complets à des particuliers.** Adresse de contact partout :
contact@deligny-rd.fr. Verrou : `SALE_READY = PAYMENT_READY && LEGAL_READY && COMPLIANCE_READY`.

**Principe qui débloque tout** : la conformité du produit fini est déclarée par SON fabricant,
c'est-à-dire DELIGNY R&D. La déclaration du fournisseur du module est un confort, pas une
obligation. Trois fournisseurs ont refusé ou ne l'ont pas : cela n'empêche pas de vendre, cela
oblige à faire l'évaluation soi-même, sur la lampe assemblée.

## Chemin critique

    commande des modules  →  lampe d'essai assemblée  →  essai CEM  →  déclaration UE  →  VENTE
         (2 à 4 sem.)            (1 jour)              (2 à 6 sem.)      (1 jour)

Tout le reste (éco-organismes, notice, marquage, paiement) avance EN PARALLÈLE et ne bloque pas.
Conséquence : commander les modules est l'action la plus urgente, car elle est en tête de chaîne.

## Étape 1 — Modules (à faire aujourd'hui)

- [x] **Demande RTR LED envoyée le 01/10/2026** via Alibaba (Olivia Liu), 5 pièces, documents exigés
      avant commande : RoHS 10 substances, REACH SVHC, CEM EN 55015 et EN 61547, fiche technique
      avec flux en lumens, EN 62471. Question posée sur l'existence d'une version blanc chaud 3000 K
      sans télécommande RGB. Un premier mail leur avait été adressé le 28/09.
- [ ] Commander **5 modules** chez un revendeur rapide, en parallèle, pour disposer de la matière
      sous une semaine et lancer les essais internes sans attendre les papiers.
- [ ] Demander à la commande : rapports RoHS, REACH SVHC, CEM, et fiche technique avec le flux en
      lumens. Ces pièces deviennent des annexes de NOTRE dossier.
- [ ] À réception : mesurer le module réel, disque et hauteur, et vérifier la platine.

- [ ] **FOURNISSEUR CANDIDAT TROUVÉ le 07/10/2026 : Shenzhen OPTO365 Technology Co., Ltd.**
      12 ans sur Alibaba, fondée 2013, vérifiée par SGS, 4,8/5 sur 2 205 avis dont 39 de France,
      réponse sous 3 h, 96,5 % de livraison à l'heure. Marchés : USA 26 %, Pologne 17 %, Italie 9 %,
      France 6 %. Fiche produit portant **Declaration of Conformity (3), CE et RoHS**, et surtout la
      mention **« Personnel responsable au sein de l'UE »**, c'est-à-dire le responsable exigé par le
      règlement 2023/988 que personne d'autre n'a su nommer. Catalogue contenant exactement notre
      besoin : module USB 5 V rond pour lampes imprimées en 3D, kit Bambu Lab 001, blanc chaud,
      MOQ 10, 1,04 à 1,80 EUR pièce.
      **Message envoyé le 07/10/2026** à Anna Liao via la messagerie Alibaba : déclaration de
      conformité, rapport RoHS, fiche technique avec le flux en lumens, et nom du responsable UE.
      Leur temps de réponse annoncé est de 3 h, donc une réponse est attendue sous 24 h.

## Étape 2 — Essai CEM (seule dépense réelle)

- [ ] Demander un devis à trois laboratoires français pour EN 55015 (émission) et EN 61547
      (immunité) sur la lampe assemblée. Ordre de grandeur : 1 000 à 2 500 EUR.
- [ ] Assembler deux lampes d'essai dès réception des modules.
- [ ] Faire l'essai. Un seul essai couvre la gamme tant que le module ne change pas.

## Étape 3 — Dossier technique (rédaction, coût nul)

- [ ] **RoHS par voie documentaire** EN IEC 63000 : déclarations fournisseurs + nos propres pièces.
- [ ] **EN IEC 62471** photobiologie : classement en groupe de risque, par analyse si possible.
- [ ] **Analyse de risque** règlement (UE) 2023/988.
- [ ] **Essais maison à documenter** : montée en température de la coque PLA après 4 h allumée
      (le PLA flue vers 55-60 °C), stabilité au basculement, tenue du câble en traction.
- [ ] **Notice en français** : usage, alimentation USB 5 V par adaptateur conforme NON FOURNI,
      entretien, fin de vie. Ne jamais fournir l'adaptateur secteur : le secteur reste hors produit.
- [ ] **Déclaration UE de conformité** signée, couvrant 2014/30/UE et 2011/65/UE, avec mention que
      la 2014/35/UE ne s'applique pas sous 75 V continu.

## Étape 4 — EPREL

- [ ] Déterminer si le module est une source lumineuse au sens du règlement (dépend du flux).
- [ ] Si oui : enregistrer la source, avec les données photométriques du fournisseur ou mesurées.

## Étape 5 — Filières REP (en cours, parallèle)

- [x] **ecosystem, DEEE** : demande envoyée le 28/09. Contrat DocuSign, déclaration prévisionnelle,
      paiement d'avance, puis identifiant unique.
- [ ] **Citeo, emballages** : compte à créer sur clients.citeo.com, choix « Adhésion Client ».
      Forfait d'environ 80 à 110 EUR HT par an sous 10 000 unités, identifiant unique inclus.
- [ ] Les deux identifiants uniques dans les CGV et sur le site.
- [ ] Éco-participation affichée, séparée du prix, et sur les factures.
- [ ] Marquage : CE, référence du modèle, adresse DELIGNY R&D, poubelle barrée, Triman et info-tri
      détaillé par élément. Kits graphiques à prendre chez les éco-organismes.
- [ ] Fiche produit « qualités et caractéristiques environnementales » et plan de prévention 5 ans.

## Étape 6 — Vente (technique, presque prête)

- [x] Chaîne commande → STL → ZIP → atelier, vérifiée de bout en bout.
- [x] Fichier de production posé à Z = 0, invariant bloquant, étanche, 474 098 triangles.
- [x] Preuve trancheur : aucun périmètre perdu, première couche continue, aucun support aberrant.
- [ ] Clé Mollie du studio dans le profil HUB, puis vérification du passage de `vente_fermee` au
      paiement réel.
- [ ] Rouvrir le moteur public : sans risque, les portes de vente restant fail-closed.
- [ ] Basculer `COMPLIANCE_READY` seulement quand la déclaration UE est signée.

## Étape 7 — Ce qui décide vraiment

- [ ] **Trois ventes réelles.** Ne pas industrialiser, ne pas acheter de seconde imprimante, ne pas
      optimiser les 22 h 46 d'impression avant de les avoir.

## Repères

| Élément | Valeur |
|---|---|
| Temps machine | 22 h 46 min par lampe, A1, 0,20 mm |
| Matière | environ 192 g de PLA |
| Cible | 2 000 à 3 000 EUR par mois, soit 8 à 13 lampes, environ 3 par semaine |
| Budget conformité | 1 500 à 3 500 EUR une seule fois, dominé par l'essai CEM |
