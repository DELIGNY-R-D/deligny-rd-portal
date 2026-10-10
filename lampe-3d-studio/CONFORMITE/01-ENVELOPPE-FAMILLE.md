# 01 — Famille de produits et limites de conception

## Pourquoi une famille

Chaque lampe vendue possède une **coque unique**, générée par le configurateur à partir des choix
du client. La partie électrique, elle, est **invariante** : un module LED USB 5 V du commerce et
une pièce de liaison imprimée commune. La coque est passive, non conductrice, et n'ajoute aucun
composant électrique.

La conformité est donc évaluée **au niveau de la famille**, et non lampe par lampe. Les essais et
évaluations portent sur des configurations représentatives et sur les cas les plus défavorables
définis ci-dessous. Toute lampe produite reste dans l'enveloppe, car le configurateur refuse
mécaniquement d'en sortir.

## Désignation

- Famille : **Lampe décorative DELIGNY, COQUE-PARAM V1**
- Référence individuelle : numéro de commande, format `DL-AAMMJJ-XXXX`, porté sur le produit
  et sur la facture, qui identifie de façon unique la géométrie livrée.

## Partie invariante

| Élément | Caractéristique |
|---|---|
| Source lumineuse | module LED USB 5 V du commerce, type Kit 001, disque 59,5 mm |
| Alimentation | 5 V continu par port USB. **Adaptateur secteur non fourni** |
| Tension | très basse tension de sécurité. Aucun circuit à plus de 5 V dans le produit |
| Fixation | platine imprimée, 2 vis à 28,00 mm d'entraxe, serre-câble intégré |
| Bague d'assise | Ø 104,00 mm, hauteur 20,70 mm, assise à 9,00 mm |

## Limites de conception imposées par le configurateur

Ces bornes sont appliquées par le logiciel, qui refuse toute géométrie hors limites.

| Paramètre | Borne |
|---|---|
| Hauteur totale | 60 mm minimum, 252 mm maximum |
| Rayon maximal | 115 mm |
| Épaisseur de paroi | 0,4 mm minimum, 10 mm maximum, **1,8 mm par défaut** |
| Angle de basculement | **25° minimum**, calculé sur le centre de gravité réel du maillage |
| Étanchéité du maillage | vérifiée à l'export, maillage fermé |
| Pose | fichier de production posé à Z = 0, invariant bloquant à l'export |

## Cas les plus défavorables retenus pour les essais

| Risque | Cas défavorable | Pièce concernée |
|---|---|---|
| Échauffement | plus petit volume intérieur, paroi la plus épaisse, module au plus près de la paroi | 05 |
| Basculement | hauteur maximale avec le plus petit diamètre d'assise admis, soit 25° | 05 |
| Arrachement du câble | serre-câble en configuration standard | 05 |
| CEM | configuration électrique unique, donc un seul cas | 02 |

## Matériau

Coque et platine imprimées en **PLA**, filament de qualité commerciale.
[VÉRIFIER] Conserver la fiche technique du filament utilisé et sa déclaration de non-présence
de substances SVHC, fournie par le fabricant de filament.
