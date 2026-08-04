"""Génère la notice PDF de prise en main de ColoSmart Training.

Deux notices en un seul document : une partie membre (à envoyer au client à son
inscription) et une partie coach. Le contenu suit l'application réelle — quand
un écran change, mets ce fichier à jour et relance :

    python docs/notice/build_notice.py

Dépendance : reportlab (hors dépendances du projet, la notice n'est régénérée
qu'à la main).
"""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

OUT = Path(__file__).resolve().parent.parent / "notice-prise-en-main.pdf"

DARK = colors.HexColor("#1E2A22")
GREEN = colors.HexColor("#2D5A35")
MID_GREEN = colors.HexColor("#3A8A4D")
AMBER = colors.HexColor("#D4A53B")
RED = colors.HexColor("#C9483A")
MUTED = colors.HexColor("#6B7A70")
RULE = colors.HexColor("#D8E0DA")
SURFACE = colors.HexColor("#F2F5F2")

styles = getSampleStyleSheet()


def style(name, **kwargs):
    base = kwargs.pop("parent", styles["Normal"])
    return ParagraphStyle(name, parent=base, **kwargs)


S = {
    "cover_title": style(
        "cover_title", fontName="Helvetica-Bold", fontSize=34, leading=38, textColor=DARK
    ),
    "cover_sub": style("cover_sub", fontName="Helvetica", fontSize=13, leading=19, textColor=MUTED),
    "part": style(
        "part", fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=colors.white
    ),
    "h1": style(
        "h1", fontName="Helvetica-Bold", fontSize=15, leading=19, textColor=GREEN, spaceBefore=14,
        spaceAfter=6,
    ),
    "h2": style(
        "h2", fontName="Helvetica-Bold", fontSize=11, leading=15, textColor=DARK, spaceBefore=8,
        spaceAfter=3,
    ),
    "body": style(
        "body", fontName="Helvetica", fontSize=9.8, leading=14.5, textColor=DARK,
        alignment=TA_LEFT, spaceAfter=5,
    ),
    "small": style("small", fontName="Helvetica", fontSize=8.5, leading=12, textColor=MUTED),
    "cell": style("cell", fontName="Helvetica", fontSize=9, leading=12.5, textColor=DARK),
    "cell_b": style("cell_b", fontName="Helvetica-Bold", fontSize=9, leading=12.5, textColor=DARK),
    "callout": style(
        "callout", fontName="Helvetica", fontSize=9.5, leading=14, textColor=DARK, leftIndent=8,
        rightIndent=8, spaceBefore=4, spaceAfter=4,
    ),
}


def p(text, key="body"):
    return Paragraph(text, S[key])


def bullets(items, bullet="—"):
    return ListFlowable(
        [ListItem(p(item), leftIndent=12, value=bullet) for item in items],
        bulletType="bullet",
        start=bullet,
        leftIndent=12,
        bulletFontName="Helvetica",
        bulletFontSize=9,
    )


def callout(text, accent=AMBER, bg=colors.HexColor("#FBF4E2")):
    """Encadré d'avertissement : la barre de couleur porte le niveau d'alerte."""
    table = Table([[Paragraph(text, S["callout"])]], colWidths=[165 * mm])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), bg),
                ("LINEBEFORE", (0, 0), (0, -1), 3, accent),
                ("LEFTPADDING", (0, 0), (-1, -1), 10),
                ("RIGHTPADDING", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
            ]
        )
    )
    return table


def data_table(rows, widths, header=True):
    body = [[Paragraph(c, S["cell_b" if header and i == 0 else "cell"]) for c in row]
            for i, row in enumerate(rows)]
    table = Table(body, colWidths=widths, hAlign="LEFT")
    commands = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LEFTPADDING", (0, 0), (-1, -1), 8),
        ("RIGHTPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, -2), 0.5, RULE),
    ]
    if header:
        commands += [
            ("BACKGROUND", (0, 0), (-1, 0), SURFACE),
            ("LINEBELOW", (0, 0), (-1, 0), 1, GREEN),
        ]
    table.setStyle(TableStyle(commands))
    return table


def part_banner(number, title, subtitle):
    inner = Table(
        [[Paragraph(f"PARTIE {number}", S["small"])], [Paragraph(title, S["part"])]],
        colWidths=[165 * mm],
    )
    inner.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), GREEN),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.white),
                ("LEFTPADDING", (0, 0), (-1, -1), 14),
                ("TOPPADDING", (0, 0), (0, 0), 12),
                ("BOTTOMPADDING", (0, 1), (0, 1), 12),
                ("BOTTOMPADDING", (0, 0), (0, 0), 0),
                ("TOPPADDING", (0, 1), (0, 1), 0),
            ]
        )
    )
    return KeepTogether([inner, Spacer(1, 4), p(subtitle, "small"), Spacer(1, 6)])


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(RULE)
    canvas.setLineWidth(0.5)
    canvas.line(22 * mm, 15 * mm, 188 * mm, 15 * mm)
    canvas.setFont("Helvetica", 7.5)
    canvas.setFillColor(MUTED)
    canvas.drawString(22 * mm, 10 * mm, "ColoSmart Training - notice de prise en main")
    canvas.drawRightString(188 * mm, 10 * mm, f"page {doc.page}")
    canvas.restoreState()


story = []

# ── Couverture ───────────────────────────────────────────────────────────────
story += [
    Spacer(1, 45 * mm),
    p("ColoSmart Training", "cover_title"),
    Spacer(1, 4),
    p("Notice de prise en main", "cover_sub"),
    Spacer(1, 10 * mm),
]
cover_rule = Table([[""]], colWidths=[40 * mm], rowHeights=[3])
cover_rule.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), MID_GREEN)]))
story += [
    cover_rule,
    Spacer(1, 10 * mm),
    p(
        "Ce document se lit en deux temps. La <b>partie 1</b> est destinée aux membres : "
        "envoie-la telle quelle à un nouveau client. La <b>partie 2</b> est pour le coach.",
        "body",
    ),
    Spacer(1, 3 * mm),
    p(
        "L'application s'utilise depuis un navigateur, sur téléphone comme sur ordinateur. "
        "Rien à installer.",
        "body",
    ),
    PageBreak(),
]

# ── Partie 1 — Membre ────────────────────────────────────────────────────────
story += [
    part_banner("1", "Pour le membre", "Ta séance, du planning au ressenti."),
    p("Premiers pas", "h1"),
    p(
        "Ton coach t'envoie une invitation par e-mail. Le lien te fait choisir un mot de passe, "
        "puis quelques questions te situent (niveau, matériel, objectifs). Ensuite tu arrives "
        "sur ton accueil.",
    ),
    p("Les sept onglets, en bas de l'écran", "h2"),
    data_table(
        [
            ["Onglet", "À quoi il sert"],
            ["Accueil", "Ta prochaine séance, ta semaine en cours, un accès direct au démarrage."],
            ["Programme", "Toutes les séances de ta semaine, exercice par exercice, avec les vidéos de démo."],
            ["Planning", "Tu poses tes séances sur les jours qui t'arrangent."],
            ["Carnet", "L'historique de ce que tu as fait : charges, répétitions, ressentis."],
            ["Progrès", "Tes courbes : volume, charges, régularité."],
            ["Messages", "La discussion avec ton coach."],
            ["Profil", "Tes infos, ton mot de passe, tes préférences."],
        ],
        widths=[32 * mm, 133 * mm],
    ),
    p("Poser ses séances dans la semaine", "h1"),
    p(
        "Dans <b>Planning</b>, les séances que ton coach a prévues apparaissent en haut, dans "
        "« À planifier ». Deux façons de les placer :",
    ),
    bullets(
        [
            "<b>Tu tapes dessus</b> : un menu s'ouvre avec les sept jours de la semaine, tu choisis.",
            "<b>Tu la fais glisser</b> avec le doigt jusqu'au jour voulu.",
        ]
    ),
    p(
        "Une séance déjà placée s'ouvre d'un appui : tu peux la démarrer, la déplacer à un autre "
        "jour, la remplacer par du repos ou la retirer. Ton coach est prévenu automatiquement "
        "quand tu déplaces quelque chose — inutile de lui écrire pour ça.",
    ),
    callout(
        "<b>Une séance commencée puis abandonnée</b> reste affichée sur son jour en orange. "
        "Appuie dessus pour la reprendre là où tu en étais, ou pour l'annuler et la replanifier.",
        accent=AMBER,
    ),
    PageBreak(),
    p("Faire sa séance", "h1"),
    p(
        "Depuis l'accueil ou le planning, tu démarres la séance. L'application te guide bloc par "
        "bloc. Selon le réglage choisi par ton coach, tu es dans l'un des deux modes :",
    ),
    data_table(
        [
            ["Mode", "Comment ça se passe"],
            [
                "Débutant",
                "L'app t'accompagne série par série. Tu saisis la charge, les répétitions et ton "
                "ressenti (RPE) à chaque série. C'est le mode par défaut, et le bon pour "
                "commencer : il t'apprend les exercices.",
            ],
            [
                "Expert",
                "Tu déroules ta séance librement, et tu renseignes ton ressenti par exercice au "
                "récapitulatif final. Plus rapide, une fois les mouvements maîtrisés.",
            ],
        ],
        widths=[32 * mm, 133 * mm],
    ),
    p("Les blocs particuliers", "h2"),
    data_table(
        [
            ["Bloc", "Ce que tu fais"],
            ["Superset", "Tu enchaînes deux exercices sans repos, puis tu prends la récup commune."],
            ["Circuit", "Tu tournes sur toutes les stations du bloc, puis tu recommences un tour."],
            [
                "EMOM",
                "Un chrono lance une série au début de chaque minute. Le temps qu'il te reste dans "
                "la minute, c'est ton repos.",
            ],
            [
                "Ladder",
                "Comme un EMOM, mais le nombre de répétitions monte puis redescend : 3, 4, 5, 4, 3, "
                "4, 5... L'écran t'annonce la marche suivante avant le bip.",
            ],
            ["Dropset", "Tu enchaînes sans repos en baissant la charge jusqu'à l'échec technique."],
        ],
        widths=[32 * mm, 133 * mm],
    ),
    p("Le chrono de repos", "h2"),
    p(
        "Il continue de tourner même si tu sors de l'application ou si tu éteins l'écran. "
        "Tu retrouves le temps réel restant en revenant.",
    ),
    p("Signaler une douleur, envoyer une vidéo", "h2"),
    p(
        "Un bouton « Signaler une douleur » est disponible sur chaque exercice : zone, intensité, "
        "commentaire. Ça remonte immédiatement en haut de la liste de ton coach. Tu peux aussi "
        "joindre une vidéo de ton exécution pour qu'il corrige ta technique.",
    ),
    PageBreak(),
    p("Le RPE : la chose la plus utile que tu remplisses", "h1"),
    p(
        "Le RPE, c'est la difficulté ressentie de 1 à 10. Ce n'est pas une note de motivation ni "
        "une performance : c'est l'information qui permet à ton coach de savoir quoi augmenter, "
        "quoi alléger et quoi remplacer la semaine suivante. Une séance sans RPE, c'est une "
        "semaine adaptée à l'aveugle.",
    ),
    data_table(
        [
            ["RPE", "Ce que ça veut dire"],
            ["10", "Échec total. Impossible d'en faire une de plus."],
            ["9", "Il te restait une répétition. Très dur."],
            ["8", "Il te restait deux répétitions."],
            ["7", "Il t'en restait trois. Modéré, la zone de progression."],
            ["5 - 6", "Confortable, voire facile."],
            ["3 - 4", "Très léger : mobilité, prévention, échauffement."],
        ],
        widths=[22 * mm, 143 * mm],
    ),
    p("La pastille de couleur devant l'exercice", "h2"),
    p("Elle t'indique la consigne d'intensité attendue sur ce mouvement :"),
    data_table(
        [
            ["Couleur", "Type", "Ce qu'on attend"],
            ["Rouge", "Force", "Garde 1 à 2 répétitions en réserve. Vise RPE 7-8, jamais l'échec."],
            ["Vert", "Isolation", "Approche l'échec en fin de série. RPE 8-9."],
            ["Jaune", "Explosif", "La qualité prime. Si la vitesse baisse, réduis. RPE 6-7."],
            ["Vert clair", "Mobilité", "Amplitude maximale contrôlée, jamais de douleur. RPE 3-5."],
            ["Bleu", "Prévention", "Contrôle total, pas de fatigue excessive. RPE 3-5."],
        ],
        widths=[24 * mm, 26 * mm, 115 * mm],
    ),
    callout(
        "Renseigne ton RPE même quand la séance était facile. Un RPE bas est une information "
        "aussi utile qu'un RPE haut : il dit à ton coach qu'il peut charger davantage.",
        accent=MID_GREEN,
        bg=colors.HexColor("#EDF5EE"),
    ),
    PageBreak(),
]

# ── Partie 2 — Coach ─────────────────────────────────────────────────────────
story += [
    part_banner("2", "Pour le coach", "Construire, publier, adapter."),
    p("La colonne priorité", "h1"),
    p(
        "C'est ton point d'entrée quotidien. Elle ne liste que ce qui demande une décision, "
        "classé par urgence :",
    ),
    data_table(
        [
            ["Alerte", "Ce que ça veut dire"],
            ["Douleur", "Un membre a signalé une douleur. À traiter en premier."],
            ["Semaine invisible", "Une semaine est restée en brouillon alors qu'elle a commencé : le membre ne voit aucune séance."],
            ["RPE élevé", "Un ressenti à 9 ou 10 sur une séance que tu n'as pas encore vue."],
            ["Vidéo à revoir", "Un membre a envoyé une vidéo technique."],
            ["Message", "Un message non lu."],
        ],
        widths=[38 * mm, 127 * mm],
    ),
    p("Construire un programme", "h1"),
    p(
        "Depuis <b>Programmes</b>, tu montes tes séances bloc par bloc. Chaque exercice porte une "
        "couleur (l'intensité attendue), un type de bloc, une récup et un RPE cible. "
        "L'onglet <b>Import Excel</b> reprend un programme existant sans le ressaisir, et la "
        "<b>Bibliothèque</b> stocke tes exercices avec leurs vidéos de démonstration.",
    ),
    p("Deux blocs à saisir différemment", "h2"),
    p(
        "Pour un <b>EMOM</b> et un <b>Ladder</b>, les deux premières cases changent de sens et "
        "sont renommées en conséquence :",
    ),
    data_table(
        [
            ["Case", "EMOM", "Ladder"],
            ["Durée (min)", "Durée totale du bloc", "Durée totale du bloc"],
            [
                "Reps / min",
                "Répétitions par minute. « 3/4 » alterne 3 puis 4.",
                "L'échelle : « 3/4/5 » (ou « 3-5 »), ou descendante « 5/4/3 ». "
                "Elle monte puis redescend en boucle : 3, 4, 5, 4, 3, 4...",
            ],
        ],
        widths=[28 * mm, 58 * mm, 79 * mm],
    ),
    callout(
        "<b>Une semaine reste invisible tant qu'elle est en brouillon.</b> Publie-la depuis le "
        "panneau des semaines de la fiche membre. C'est l'oubli le plus coûteux : le membre "
        "ouvre l'application et ne trouve rien, sans savoir pourquoi.",
        accent=RED,
        bg=colors.HexColor("#FBEEEC"),
    ),
    p("Adapter la semaine suivante", "h1"),
    p(
        "Depuis la fiche membre, « Adapter la semaine » reprend la semaine précédente et affiche, "
        "sous chaque exercice, le <b>retour du membre</b> : son RPE, une douleur signalée, un "
        "exercice raté. L'application propose alors des ajustements (alléger, charger, remplacer) "
        "que tu valides ou non — rien n'est appliqué sans toi.",
    ),
    p(
        "Si tu renommes un exercice d'une semaine à l'autre, le retour est quand même rattaché "
        "et le nom d'origine s'affiche sous le RPE, pour que tu vérifies qu'il s'agit bien du "
        "même mouvement.",
    ),
    p("Régler le mode d'un membre", "h1"),
    p(
        "Sur la fiche membre, tu bascules le membre entre <b>débutant</b> et <b>expert</b>. "
        "Laisse un nouveau client en débutant le temps qu'il assimile les mouvements : la saisie "
        "série par série est aussi ce qui te donne les données les plus fines.",
    ),
    p("Inviter un client", "h1"),
    p(
        "Onglet <b>Invitations</b> : tu saisis son e-mail, il reçoit son lien d'inscription. "
        "Assigne-lui ensuite un programme et <b>publie sa première semaine</b> avant de lui dire "
        "de se connecter.",
    ),
    Spacer(1, 6 * mm),
    p(
        "Cette notice suit l'état de l'application au moment de sa génération. En cas d'écart "
        "avec un écran, c'est l'application qui fait foi.",
        "small",
    ),
]

doc = BaseDocTemplate(
    str(OUT),
    pagesize=A4,
    leftMargin=22 * mm,
    rightMargin=22 * mm,
    topMargin=20 * mm,
    bottomMargin=22 * mm,
    title="ColoSmart Training - Notice de prise en main",
    author="ColoSmart Training",
)
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="body")
doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=footer)])
doc.build(story)
print(f"écrit : {OUT}")
