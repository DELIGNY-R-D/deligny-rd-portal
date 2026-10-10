# Fiche de spécification — source lumineuse pour lampe DELIGNY

Version du 28/09/2026. Destinée aux distributeurs et fabricants européens.
Volume : 5 pièces en qualification, puis réapprovisionnements de 20 à 50, environ 100 à 150 par an.
Aucun engagement de volume. La sélection se fait sur les documents d'abord, le prix ensuite.

## 1. Conditions éliminatoires, documentaires

Sans ces pièces, le module est écarté quel que soit son prix.

| Exigence | Détail |
|---|---|
| Déclaration UE de conformité | nommant la référence ET la version matérielle livrée, datée, signée |
| Directives couvertes | 2014/30/UE (CEM) et 2011/65/UE (RoHS) |
| Normes CEM | EN 55015 en émission, EN 61547 en immunité |
| RoHS | dix substances, par exemple via EN IEC 63000, rapport de laboratoire accrédité ISO 17025 |
| Photobiologie | classification EN IEC 62471, groupe de risque déclaré |
| REACH | déclaration SVHC précisant la version et la date de la liste candidate |
| EPREL | numéro d'enregistrement de la source lumineuse, ou justification écrite de hors champ |
| Metteur sur le marché | entité juridique dans l'Union et son adresse, afin que DELIGNY R&D ne devienne pas fabricant de la source |
| Changements | engagement d'informer de toute modification de nomenclature ou de LED, qui invalide notre dossier |

## 2. Contraintes électriques

- Alimentation 5 V continu par USB type A, très basse tension de sécurité.
- Puissance au plus 5 W, courant au plus 1 A.
- Câble intégré d'au moins 1,5 m, interrupteur ou variateur en ligne souhaité.
- Aucun raccordement au secteur, en aucun point du produit.

## 3. Contraintes mécaniques

Relevées sur le montage actuel. La platine de fixation est une pièce imprimée paramétrique,
donc une géométrie différente reste acceptable si elle est documentée.

| Cote | Valeur actuelle | Tolérance acceptable |
|---|---|---|
| Diamètre du disque | 59,50 mm | 40 à 70 mm |
| Épaisseur | 8,20 mm | jusqu'à 12 mm |
| Fixation | 2 perçages Ø 4,00 mm à 28,00 mm d'entraxe | autre schéma accepté si coté |
| Sortie de câble | serre-câble 17 × 6,06 × 7,00 mm, gorge 5,22 × 1,33 mm | câble au plus Ø 5 mm |
| Émission | vers le bas, dans un abat-jour translucide | diffuse, non directive |

## 4. Photométrie demandée

- Température de couleur 3000 K, blanc chaud.
- Flux lumineux entre 150 et 400 lumens, valeur exacte à déclarer en lumens.
- Indice de rendu des couleurs au moins 80.
- Papillotement conforme aux exigences du règlement 2019/2020, valeurs PstLM et SVM déclarées.

## 5. Questions à poser au fournisseur

1. La déclaration UE est-elle publique et téléchargeable ?
2. Quel est le numéro EPREL de la source, et sous quel nom est-elle enregistrée ?
3. Quelle entité met le produit sur le marché de l'Union ?
4. Le stock est-il en Europe, et quel est le délai pour 5 pièces puis pour 50 ?
5. Le produit existe-t-il en format puck de 50 à 60 mm, qui éviterait toute refonte de la platine ?

## 6. Ce que ce choix évite

À notre volume, environ 150 lampes par an, financer nos propres essais CEM et photobiologiques
coûterait par lampe autant qu'un module documenté acheté 20 à 30 EUR. Le module documenté est donc
retenu même à vingt-cinq fois le prix unitaire d'un module générique non documenté.

## 7. Candidat vérifié le 29/09/2026 : Häfele Loox5 LED 2094

**Référence 833.72.531**, blanc chaud 3000 K, aspect chrome.
**Enregistrement EPREL vérifié dans la base européenne : n° 853176**
(eprel.ec.europa.eu/screen/product/lightsources/853176).

| Donnée (source EPREL, pas le vendeur) | Valeur |
|---|---|
| Fournisseur | Häfele SE & Co KG, **type : fabricant** |
| Adresse | Adolf-Häfele-Str. 1, 72202 Nagold, Allemagne |
| Contact | info@haefele.de, +49 7452 950 |
| Mise sur le marché UE | depuis le 01/08/2021, fiche corrigée le 19/09/2024 |
| Technologie | LED, source dirigée, **non secteur**, culot 12V Loox5 |
| Puissance | 2,50 W, veille 0,00 W, 3 kWh/1 000 h |
| Flux lumineux utile | **150 lm** |
| Température de couleur | 3 000 K |
| IRC | **90**, R9 = 50 |
| Angle de faisceau | 105°, intensité crête 57 cd |
| Dimensions hors tout | **15 × 65 × 65 mm**, perçage 58 à 60 mm |
| Documents publics | étiquette énergétique PDF et fiche d'information produit en 26 langues |

**Ce qui reste à obtenir** : la déclaration UE de conformité, à demander à Häfele, et le choix du
bloc d'alimentation Loox5 12 V, lui aussi documenté par le même fabricant.

**Point de vigilance optique** : 150 lm est une valeur basse pour un abat-jour de 174 mm. Le système
Loox permet de raccorder plusieurs modules sur une même alimentation : deux modules donnent 300 lm
pour environ 20 EUR de source. À trancher par un essai visuel, pas par le calcul.
