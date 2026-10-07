/* Rattachement indicatif des marques à leur groupe (industriels) ou à leur enseigne (marques de distributeur).
   Établi de connaissance générale du marché français, état d'octobre 2026. Les marques non listées restent seules. */
"use strict";
const { plat } = require("./moteur.js");
// Le « 's » anglais est collé au mot : Bret's, Brets et Bret s donnent la même clé.
const cle = s => plat(s).replace(/['’`]s\b/g, "s").replace(/&/g, " et ").replace(/[^a-z0-9]+/g, " ").trim().replace(/([a-z0-9]) s(?= |$)/g, "$1s");

// [groupe, type, marques...] : une marque se compare par sa clé normalisée ; un astérisque final = préfixe.
const REGLES = [
  // ---------- Enseignes (MDD) ----------
  ["Carrefour", "mdd", "carrefour*", "reflets de france", "simpl", "les cosmonautes", "bon app carrefour", "produits blancs"],
  ["E.Leclerc", "mdd", "leclerc*", "e leclerc*", "marque repere*", "repere", "eco+", "eco plus", "nos regions ont du talent*", "bio village*", "delisse", "tablier blanc", "p tit deli", "ptit deli", "turini", "jafaden", "rustica", "tokapi", "les croises", "ronde des mers", "tradilege", "saint azay", "notre jardin", "plein sud", "equador", "couleurs vives", "tradizioni d italia", "volandry", "epi d or", "trofic", "l origine du gout", "tendre et plus"],
  ["Intermarché", "mdd", "intermarche*", "paturages", "monique ranou", "paquito", "saint eloi", "st eloi", "top budget", "itineraire des saveurs*", "chabrior", "ivoria", "claude leger", "odyssee", "capitaine cook", "onno", "fiorini", "jean roze", "adelie", "elodie", "volae", "planteur des tropiques", "regain", "canaillou", "pommette", "look", "selection intermarche", "les mousquetaires", "bouton d or", "netto", "ranou"],
  ["Coopérative U", "mdd", "u", "u bio", "u saveurs", "bien vu", "prix mini", "les produits u", "produits u", "u tout petits", "super u", "systeme u", "u mat et lou", "u oxygn", "u nature", "u les produits", "u de france", "hyper u", "marque u", "magasins u", "u cook"],
  ["Auchan", "mdd", "auchan*", "mmm", "pouce", "cultivons le bon", "rik et rok", "rik rok", "mieux vivre bio"],
  ["Casino et Monoprix", "mdd", "casino*", "tous les jours", "leader price*", "monoprix*", "franprix*", "ca vient d ici", "naturalia*", "club des sommeliers", "doodingues", "les doodingues", "terre et saveurs", "le prix gagnant"],
  ["Lidl", "mdd", "lidl*", "milbona", "envia", "crownfield", "fin carre", "sondey", "snack day", "freeway", "solevita", "combino", "italiamo", "deluxe", "chene d argent", "saint alby", "bellarom", "tastino", "toque du chef", "vemondo", "alesto", "belbake", "dulano", "favorina", "baresa", "kania", "freshona", "nixe", "ocean sea", "gelatelli", "mister choc", "maribel", "golden sun", "vitasia", "culinea", "trattoria alfredo", "mcennedy", "eridanous", "sol et mar", "duc de coeur", "chef select", "pilos", "lupilu", "vitafit", "bio organic", "primadonna", "j d gross", "jd gross", "lord nelson", "saguaro", "next level meat", "my best veggie", "harvest basket", "saveurs de nos regions"],
  ["Aldi", "mdd", "aldi*", "milsani", "moreno", "choceur", "biscotto", "trader joe s", "gut bio", "golden bridge", "rio d oro", "cucina", "le marsigny", "pays gourmand", "bon ri", "knusperone", "wonnemeyer", "moser roth", "snack fun", "nature active bio", "mucci", "ofterdinger", "grandessa", "specially selected", "milfina", "all seasons", "mamia", "westminster", "happy harvest", "be light", "almare", "choco bistro", "tamara"],
  ["Picard", "mdd", "picard*"],
  ["Thiriet", "mdd", "thiriet*", "maison thiriet"],
  ["Cora et Match", "mdd", "cora*", "winny", "match"],
  ["Biocoop", "mdd", "biocoop*", "ensemble"],
  ["La Vie Claire", "mdd", "la vie claire*"],
  ["Bio c' Bon", "mdd", "bio c bon*"],
  ["Grand Frais", "mdd", "grand frais*"],
  ["Marks & Spencer", "mdd", "marks et spencer*", "m et s*", "marks spencer"],
  ["Hema", "mdd", "hema"],
  ["Albert Heijn", "mdd", "albert heijn*", "ah", "ah biologisch", "ah basic"],
  ["Delhaize", "mdd", "delhaize*", "365"],
  ["Colruyt", "mdd", "colruyt*", "boni", "boni selection", "everyday"],
  ["Migros", "mdd", "migros*", "m classic", "m budget"],
  ["Coop", "mdd", "coop*", "naturaplan"],
  ["Costco", "mdd", "kirkland*"],
  ["Metro", "mdd", "metro chef", "metro*", "aro", "rioba", "fine life"],
  ["Tesco", "mdd", "tesco*"],
  ["Rewe", "mdd", "rewe*"],
  ["Edeka", "mdd", "edeka*", "gut et gunstig"],
  ["Mercadona", "mdd", "hacendado"],
  ["Decathlon", "mdd", "decathlon*", "aptonia", "domyos", "corength"],
  // ---------- Industriels ----------
  ["Mars", "ind", "mars", "mars wrigley", "snickers", "twix", "bounty", "m et m s", "m m s", "mms", "milky way", "balisto", "maltesers", "celebrations", "ben s original", "uncle ben s", "suzi wan", "ebly", "dolmio", "skittles", "freedent", "airwaves", "be kind", "kind", "kellogg s*", "kelloggs*", "kellogg", "pringles", "special k", "frosties", "coco pops", "tresor", "miel pops", "smacks", "extra", "all bran", "rice krispies", "mars chocolat", "galaxy", "dove"],
  ["Ferrero", "ind", "ferrero*", "kinder*", "nutella*", "tic tac", "delacre", "raffaello", "mon cheri", "duplo", "hanuta", "giotto", "michel et augustin", "carambar", "carambar et co", "poulain", "krema", "lutti", "malabar", "terry s", "la pie qui chante", "michoko", "regal ad", "suchard", "rocher suchard", "pocket coffee", "thorntons", "eat natural"],
  ["Mondelez", "ind", "mondelez*", "lu", "milka", "oreo", "cote d or", "belvita", "prince", "granola", "pepito", "mikado", "tuc", "toblerone", "cadbury", "philadelphia", "daim", "hollywood", "pim s", "petit ecolier", "heudebert", "pelletier", "cracotte", "ourson", "lulu", "napolitain", "barquette", "paille d or", "veritable petit beurre", "petit beurre lu", "belin", "clif", "clif bar", "grany", "prince de lu", "ritz", "figolu", "krisprolls", "stimorol", "cachou lajaunie", "la vosgienne"],
  ["Nestlé", "ind", "nestle*", "kitkat", "kit kat", "lion", "nesquik", "chocapic", "fitness", "maggi", "buitoni", "mousline", "nescafe", "ricore", "smarties", "crunch", "perrier", "vittel", "contrex", "s pellegrino", "san pellegrino", "sanpellegrino", "guigoz", "naturnes", "garden gourmet", "nespresso", "nido", "gloria", "quality street", "after eight", "galak", "cheerios", "golden grahams", "cini minis", "clusters", "hepar", "p tit pot", "wunda", "thomy", "nestea", "aero", "laboratoires guigoz", "nan"],
  ["Herta (Casa Tarradellas et Nestlé)", "ind", "herta*", "tendre noix", "le bon vegetal", "knacki"],
  ["Danone", "ind", "danone*", "activia", "actimel", "danette", "danonino", "gervais", "oikos", "hipro", "alpro", "evian", "volvic", "badoit", "bledina*", "gallia", "les 2 vaches", "les deux vaches", "light et free", "veloute", "fjord", "danio", "taillefine", "salvetat", "la salvetat", "recette cremeuse", "gervita", "jockey", "petit gervais", "dany", "yopro", "bledilait", "bledichef", "bledine", "provamel", "fortimel", "nutricia"],
  ["Lactalis", "ind", "lactalis*", "president", "lactel*", "galbani", "bridelice", "salakis", "societe", "lanquetot", "lou perac", "siggi s", "le petit", "lepetit", "rondele", "istara", "leerdammer", "bridel", "la laitiere", "le viennois", "viennois", "sveltesse", "yaos", "kremly", "b a", "le roitelet", "pochat", "pochat et fils", "boule d or", "chaussee aux moines", "matin leger", "eveil", "primevere", "celia", "picot", "puleva", "parmalat", "santal", "locatelli", "munster les petits amis", "ambrosi", "raguin"],
  ["Sodiaal", "ind", "sodiaal*", "candia*", "yoplait*", "entremont", "regilait", "petits filous", "perle de lait", "panier de yoplait", "yop", "calin", "calin +", "grand lait", "viva", "silhouette", "candy up", "baiko", "nutribio", "nactalia", "les fromagers cantaliens", "capitoul", "monts et terroirs", "frubes"],
  ["Savencia", "ind", "savencia*", "caprice des dieux", "st moret", "saint moret", "tartare*", "elle et vire", "saint albray", "st albray", "chavroux", "saint agur", "st agur", "fol epi", "etorki", "p tit louis", "ptit louis", "carre frais", "bresse bleu", "maroilles fauquet", "fauquet", "vieux pane", "chaumes", "aperifrais", "bordeau chesnel", "corman", "valrhona", "weiss", "la maison du chocolat", "de neuville", "revillon", "ile de france", "coeur de lion", "le rustique", "richesmonts"],
  ["Bel", "ind", "bel", "groupe bel", "la vache qui rit", "kiri", "babybel", "mini babybel", "boursin", "apericube", "pom potes", "materne", "gogo squeez", "nurishh", "pik et croq", "les fromageries bel", "mont blanc", "ma pause fruit", "port salut", "toastinette", "cousteron"],
  ["Andros", "ind", "andros*", "bonne maman", "mamie nova", "pierrot gourmand"],
  ["Unilever", "ind", "unilever*", "knorr", "amora", "maille", "hellmann s", "hellmanns", "marmite", "colman s", "pot noodle", "savora", "bovril"],
  ["Lipton Teas and Infusions", "ind", "lipton", "elephant", "pukka"],
  ["The Magnum Ice Cream Company", "ind", "magnum", "carte d or", "ben et jerry s", "ben jerry s", "miko", "cornetto", "solero", "viennetta", "calippo", "twister", "x pop", "ben et jerry", "ben jerry"],
  ["PepsiCo", "ind", "pepsico*", "pepsi", "pepsi max", "lay s", "lays", "doritos", "benenuts", "quaker", "7up", "seven up", "7 up", "lipton ice tea", "alvalle", "cheetos", "cruesli", "rockstar", "sunbreaks", "3d s", "walkers", "mountain dew", "gatorade", "bugles"],
  ["Coca-Cola", "ind", "coca cola*", "coca", "coke", "fanta", "sprite", "minute maid", "fuze tea", "fuzetea", "powerade", "tropico", "honest", "innocent", "costa coffee", "chaudfontaine", "finley", "smartwater", "aquarius", "nalu"],
  ["Monster Beverage", "ind", "monster", "monster energy", "burn"],
  ["General Mills", "ind", "general mills*", "haagen dazs", "old el paso", "nature valley", "betty crocker", "fibre one", "larabar"],
  ["Barilla", "ind", "barilla*", "harrys", "harry s", "wasa", "mulino bianco", "pan di stelle", "gran cereale", "pavesi"],
  ["Intersnack", "ind", "intersnack*", "vico", "curly", "monster munch", "baff", "funny frisch", "ultje", "pom bear", "hula hoops", "mccoy s", "tyrrells", "tyrrell s"],
  ["Bonduelle", "ind", "bonduelle*", "cassegrain"],
  ["Eureden", "ind", "d aucy", "daucy", "jean nicolas", "globus", "cocotine", "aubret"],
  ["Laïta", "ind", "laita", "paysan breton", "even"],
  ["Fleury Michon", "ind", "fleury michon*"],
  ["LDC", "ind", "ldc", "le gaulois", "loue", "maitre coq", "marie", "poulets de loue", "traditions d asie", "fermiers de loue", "les fermiers de loue", "doux", "fermier de loue", "la toque angevine", "luang", "regalette", "agis"],
  ["Cooperl", "ind", "cooperl", "madrange", "broceliande", "paul predault", "montagne noire"],
  ["Bigard", "ind", "bigard", "charal", "socopa"],
  ["Sigma (Aoste)", "ind", "aoste", "justin bridou", "cochonou", "campofrio"],
  ["Sodebo", "ind", "sodebo*"],
  ["McCain", "ind", "mccain*"],
  ["Nomad Foods", "ind", "findus", "iglo", "birds eye"],
  ["Dr. Oetker", "ind", "dr oetker*", "ancel", "alsa", "ristorante", "paula"],
  ["Panzani", "ind", "panzani*", "lustucru", "lustucru selection", "ferrero semoule", "zakia", "regia"],
  ["Ebro Foods", "ind", "taureau aile", "riz taureau aile", "garofalo", "tilda", "bertagni", "lustucru frais"],
  ["St Michel", "ind", "st michel*", "saint michel*", "biscuiterie saint michel"],
  ["Lotus Bakeries", "ind", "lotus", "lotus biscoff", "biscoff", "nakd", "trek", "bear", "kiddylicious", "peter s yard"],
  ["Haribo", "ind", "haribo*"],
  ["Lindt & Sprüngli", "ind", "lindt*", "lindor", "ghirardelli", "caffarel"],
  ["Cémoi", "ind", "cemoi*"],
  ["Eckes-Granini", "ind", "joker", "granini", "pago", "rea", "le fruit joker"],
  ["Suntory", "ind", "orangina", "schweppes", "oasis", "pulco", "champomy", "may tea", "pampryl", "banga", "ricqles", "lucozade", "ribena", "gini", "canada dry", "brut de pomme", "orangina schweppes"],
  ["Britvic France", "ind", "teisseire", "pressade", "fruite", "moulin de valdonne"],
  ["Red Bull", "ind", "red bull*"],
  ["Olga (Triballat Noyal)", "ind", "sojasun", "vrai", "petit billy", "triballat", "tante helene", "les 300 et bio", "sojade", "la bergerie", "merzer", "olga"],
  ["Nutrition & Santé", "ind", "gerble*", "cereal bio", "isostar", "gerlinea", "soy", "milical", "pesoforma", "modifast", "valpiform", "natursoy", "allergo", "bicentury", "gayelord hauser"],
  ["Léa Nature", "ind", "lea nature", "jardin bio*", "vitamont", "bisson", "primeal", "ekibio", "le pain des fleurs", "so bi o etic"],
  ["Ecotone", "ind", "bjorg", "bonneterre", "alter eco", "clipper", "evernat", "danival", "allos", "whole earth", "zonnatura", "el granero", "isola bio", "kallo"],
  ["Limagrain", "ind", "jacquet", "brossard", "savane", "jacquet brossard", "milcamps"],
  ["Pasquier", "ind", "pasquier*", "brioche pasquier", "pitch", "grillettine"],
  ["Norac", "ind", "la boulangere*", "whaou", "daunat", "dessaint"],
  ["Goûters Magiques", "ind", "gouters magiques", "le ster", "le ster le patissier", "ker cadelac", "kercadelac", "armor delices"],
  ["Tipiak", "ind", "tipiak*"],
  ["Cofigeo", "ind", "william saurin", "garbit", "raynal et roquelaure", "zapetti", "petitjean"],
  ["Bolton", "ind", "saupiquet", "rio mare", "isabel"],
  ["Thai Union", "ind", "petit navire", "parmentier", "john west", "mareblu"],
  ["Chancerelle", "ind", "connetable", "phare d eckmuhl", "pointe de penmarc h"],
  ["Labeyrie Fine Foods", "ind", "labeyrie", "blini", "delpierre", "l atelier blini", "comptoir sushi", "pere olive", "aux petits oignons"],
  ["Kraft Heinz", "ind", "heinz", "benedicta", "kraft", "hp", "lea et perrins"],
  ["Avril", "ind", "lesieur", "puget", "isio 4", "isio4", "matines", "costa d oro"],
  ["Flora Food Group", "ind", "fruit d or", "planta fin", "proactiv", "pro activ", "flora", "violife", "rama", "becel"],
  ["St Hubert", "ind", "st hubert*", "saint hubert*"],
  ["Tereos", "ind", "beghin say", "la perruche", "blonvilliers", "tereos"],
  ["Cristal Union", "ind", "daddy", "erstein", "cristalco"],
  ["Saint Louis Sucre", "ind", "saint louis", "saint louis sucre", "st louis"],
  ["JDE Peet's", "ind", "l or", "l or espresso", "senseo", "tassimo", "jacques vabre", "grand mere", "maison du cafe", "velours noir", "jacobs", "douwe egberts", "pickwick"],
  ["Lavazza", "ind", "lavazza", "carte noire"],
  ["Associated British Foods", "ind", "twinings", "ovomaltine", "jordans", "dorset cereals", "patak s", "blue dragon", "ryvita"],
  ["Froneri", "ind", "extreme", "nestle glaces", "pilpa", "nuii", "movenpick", "antica gelateria del corso"],
  ["Post Holdings", "ind", "weetabix", "alpen", "weetos"],
  ["Hero", "ind", "hero", "schwartau", "corny", "organix"],
  ["Prozis", "ind", "prozis*"],
  ["Foodspring", "ind", "foodspring*"],
  ["Myprotein (THG)", "ind", "myprotein*", "my protein", "myvegan"],
  ["Oatly", "ind", "oatly*"],
  ["Heineken", "ind", "heineken", "desperados", "pelforth", "affligem", "fischer", "edelweiss", "lagunitas", "gallia paris", "panach"],
  ["AB InBev", "ind", "leffe", "hoegaarden", "stella artois", "corona", "budweiser", "bud", "jupiler", "beck s", "tripel karmeliet", "kwak", "cubanisto"],
  ["Carlsberg", "ind", "kronenbourg", "1664", "grimbergen", "carlsberg", "tourtel", "tourtel twist", "skoll"],
  ["Bahlsen", "ind", "bahlsen", "leibniz", "pick up"],
  ["Griesson - de Beukelaer", "ind", "de beukelaer", "prinzen rolle", "griesson", "cereola"],
  ["Biscuits Bouvard", "ind", "bouvard", "biscuits bouvard"],
  ["Poult", "ind", "poult", "biscuits poult"],
  ["Storck", "ind", "storck", "werther s original", "werther s", "merci", "toffifee", "knoppers", "nimm2", "riesen", "mamba"],
  ["Perfetti Van Melle", "ind", "mentos", "chupa chups", "fruittella", "frisk", "smint"],
  ["Ritter Sport", "ind", "ritter sport", "ritter"],
  ["Soufflet (InVivo)", "ind", "francine", "treblec", "baguepi"],
  ["Famille Michaud", "ind", "lune de miel", "miel l apiculteur", "l apiculteur", "famille michaud", "michaud"],
  ["Sill", "ind", "le gall", "malo", "la potagere", "plenilait", "petit basque", "le petit basque", "grandeur nature"],
  ["Agrial", "ind", "florette", "primeale", "soignon", "loic raison", "ecusson", "kerisac", "danao", "grand fermage", "crealine", "pave d affinois"],
  ["LSDH", "ind", "lsdh", "les crudettes"],
  ["Sources Alma", "ind", "cristaline", "saint yorre", "st yorre", "vichy celestins", "courmayeur", "rozana", "thonon", "mont dore", "pierval", "vals", "saint amand", "st amand", "chateldon"],
  ["Ogeu", "ind", "ogeu", "plancoet"],
  ["Maîtres Laitiers du Cotentin", "ind", "maitres laitiers du cotentin", "campagne de france", "reo", "montebourg"],
  ["Rians", "ind", "rians", "laiteries h triballat", "la faisselle rians"]
];

// Table marque -> groupe
const EXACT = new Map(), PREFIXES = [];
const GROUPES = [];
for (const r of REGLES) {
  if (r.length <= 2) continue;
  const gi = GROUPES.length; GROUPES.push({ nom: r[0], type: r[1] });
  for (const m of r.slice(2)) {
    const k = cle(m.replace(/\*$/, ""));
    if (m.endsWith("*")) { PREFIXES.push([k, gi]); if (!EXACT.has(k)) EXACT.set(k, gi); }
    else if (!EXACT.has(k)) EXACT.set(k, gi);
  }
}
PREFIXES.sort((a, b) => b[0].length - a[0].length);
const cache = new Map();
function groupe(marqueCle) {
  if (cache.has(marqueCle)) return cache.get(marqueCle);
  let g = EXACT.has(marqueCle) ? EXACT.get(marqueCle) : -1;
  if (g < 0) for (const [p, gi] of PREFIXES) if (marqueCle.startsWith(p + " ")) { g = gi; break; }
  cache.set(marqueCle, g); return g;
}
/* Nettoie le champ marques d'Open Food Facts : première marque citée. */
function premiere(b) {
  if (b == null) return null;
  let s = Array.isArray(b) ? b[0] : String(b);
  if (!s) return null;
  s = String(s).split(",")[0].replace(/[\uFFFD\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\uFEFF]/g, " ").replace(/\s+/g, " ").trim();
  if (!s || s.length > 40 || /^(sans marque|inconnu|unknown|n\/?a|aucune|non renseigne|\?+|-+|\.+|none|generique)$/i.test(s)) return null;
  return s;
}
module.exports = { cle, groupe, GROUPES, premiere };
