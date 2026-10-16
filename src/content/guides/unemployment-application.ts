/**
 * Step-by-step guide: new application for the regular unemployment benefit (Τακτική Επιδότηση Ανεργίας, ΔΥΠΑ).
 * DRAFT — awaiting the owner's review (Workstream C, 16 Oct 2026). Not listed on /guides until approved.
 *
 * Sources read on 16 Oct 2026 (official only):
 *  [D1] ΔΥΠΑ — «Ανεργία & Παροχές Ασφάλισης Μισθωτών» (Greek page): conditions, 60-day deadline, duration, amounts,
 *       documents, the option names «ΥΠΟΒΟΛΗ ΑΙΤΗΣΗΣ» → «ΑΙΤΗΣΗ ΤΑΚΤΙΚΗΣ ΕΠΙΔΟΤΗΣΗΣ ΑΝΕΡΓΙΑΣ», 20 days / 3 months,
 *       attendance declarations, 8 working days to report changes.
 *  [D2] ΔΥΠΑ — same page in English: older amounts (€479 top band) → recorded as a conflict, Greek page preferred.
 *  [D3] ΔΥΠΑ — «Εγγραφή στο Μητρώο Ανέργων – Δελτία Ανεργίας»: registration online with TAXISnet, ΚΠΑ2 choice,
 *       3-month validity, renewal from 20 days before expiry, automatic deletion.
 *  [M]  Μίτος — «Τακτική Επιδότηση Ανεργίας» (updated 14/10/2026): documents submitted ex officio, 3-month processing,
 *       administrative appeal, free of charge.
 *  [G]  gov.gr — «Αίτηση επιδόματος ανεργίας»: registered unemployed apply online with TAXISnet credentials.
 *  [Y]  Υπουργείο Εργασίας — pilot new unemployment benefit (23/12/2024), from the 14 Oct record.
 * No screenshots were available; screens that the sources do not describe are marked as awaiting confirmation.
 */
import type { Article } from "@/lib/site/guide-catalog";

const D1 = "https://prosvasis.dypa.gov.gr/anerghia-parokhes-asfalisis-misthotwn";
const D2 = "https://prosvasis.dypa.gov.gr/en/anerghia-parokhes-asfalisis-misthotwn";
const D3 = "https://prosvasis.dypa.gov.gr/eggrafh-sto-mhtroo-anergon-deltia-anergias";
const M = "https://mitos.gov.gr/index.php/%CE%94%CE%94:%CE%A4%CE%B1%CE%BA%CF%84%CE%B9%CE%BA%CE%AE_%CE%95%CF%80%CE%B9%CE%B4%CF%8C%CF%84%CE%B7%CF%83%CE%B7_%CE%91%CE%BD%CE%B5%CF%81%CE%B3%CE%AF%CE%B1%CF%82";
const G = "https://www.gov.gr/el/services/1001289/aitese-epidomatos-anergias";
const Y = "https://ypergasias.gov.gr/neo-epidoma-anergias-me-perissotera-kinitra-gia-ergasia-pio-dikaio-pio-antapodotiko/";

export const UNEMPLOYMENT_APPLICATION: Article = {
  slug: "unemployment-benefit-application",
  kind: "procedure",
  title: {
    el: "Πώς κάνω αίτηση για τακτικό επίδομα ανεργίας στη ΔΥΠΑ",
    en: "How to apply for the regular unemployment benefit (ΔΥΠΑ)",
  },
  intro: {
    el: "Οδηγός για νέα αίτηση τακτικής επιδότησης ανεργίας, από την έκδοση του Δελτίου Ανεργίας μέχρι την απόφαση και τις δηλώσεις παρουσίας, με βάση τις επίσημες σελίδες της ΔΥΠΑ, του gov.gr και του Μίτου.",
    en: "A guide to a new application for the regular unemployment benefit, from getting the unemployment card to the decision and the attendance declarations, based on the official pages of ΔΥΠΑ, gov.gr and Mitos.",
  },
  categories: ["step-by-step", "benefits", "employment-education"],
  keywords: ["ΔΥΠΑ", "ΟΑΕΔ", "επίδομα ανεργίας", "επιδότηση ανεργίας", "δελτίο ανεργίας", "κάρτα ανεργίας", "unemployment", "benefit", "jobseeker"],
  audience: [
    { el: "Μισθωτοί των οποίων η σχέση εργασίας έληξε ή καταγγέλθηκε από τον εργοδότη και είχαν εισφορές στον κλάδο ανεργίας της ΔΥΠΑ.", en: "Employees whose employment ended or was terminated by the employer and who paid contributions to ΔΥΠΑ's unemployment branch." },
    { el: "Όσοι κάνουν αίτηση για πρώτη φορά. Για όσους έχουν επιδοτηθεί ξανά ισχύουν πρόσθετοι όροι στην επίσημη σελίδα.", en: "First-time applicants. People who received the benefit before have extra conditions on the official page." },
  ],
  provides: {
    el: "Μηνιαίο επίδομα για 5 έως 12 μήνες, ανάλογα με τις ημέρες ασφάλισης. Κατά την ελληνική σελίδα της ΔΥΠΑ: 565,00 € τον μήνα για μέσο μηνιαίο μισθό 493,09 € και άνω, 423,75 € για 246,55–493,08 € και 282,50 € έως 246,54 €. Προσαύξηση 10% για κάθε προστατευόμενο μέλος.",
    en: "A monthly benefit for 5 to 12 months, depending on insured days. According to ΔΥΠΑ's Greek page: €565.00 a month for average monthly pay of €493.09 or more, €423.75 for €246.55–€493.08 and €282.50 up to €246.54. A 10% increase for each dependent family member.",
  },
  eligibility: [
    { el: "Η σχέση εξαρτημένης εργασίας έληξε ή καταγγέλθηκε από τον εργοδότη.", en: "Your salaried employment ended or was terminated by the employer." },
    { el: "Την ημέρα της αίτησης δεν εργάζεστε σε άλλον εργοδότη ή ως ελεύθερος επαγγελματίας και είστε ικανός/ή και διαθέσιμος/η για εργασία.", en: "On the day you apply you do not work for another employer or as self-employed, and you are able and available to work." },
    { el: "Πρώτη περίπτωση: τουλάχιστον 125 ημέρες εργασίας (100 για οικοδόμους) μέσα στους 14 μήνες πριν από τη λήξη, χωρίς τους δύο τελευταίους μήνες.", en: "Case one: at least 125 days of work (100 for construction workers) in the 14 months before the end of work, not counting the last two months." },
    { el: "Δεύτερη περίπτωση: τουλάχιστον 200 ημέρες εργασίας (180 για οικοδόμους) στα δύο προηγούμενα έτη, με 80 ημέρες εξαρτημένης εργασίας σε κάθε έτος.", en: "Case two: at least 200 days of work (180 for construction workers) in the two previous years, with 80 days of salaried work in each year." },
    { el: "Εγγραφή στο μητρώο ανέργων με ενεργό Δελτίο Ανεργίας.", en: "Registration as unemployed with a valid unemployment card." },
  ],
  documents: [
    { el: "Καταγγελία σύμβασης εργασίας (Έντυπο Ε6) ή βεβαίωση λήξης σύμβασης ορισμένου χρόνου (Έντυπο Ε7). Κατά τον Μίτο υποβάλλεται αυτεπάγγελτα.", en: "Termination of employment (Form Ε6) or end of fixed-term contract (Form Ε7). According to Mitos it is retrieved automatically." },
    { el: "Έμμεση ασφαλιστική ικανότητα των προστατευόμενων μελών, εφόσον υπάρχουν (για την προσαύξηση 10%).", en: "Indirect insurance cover of dependent family members, if any (for the 10% increase)." },
    { el: "IBAN λογαριασμού όπου είστε δικαιούχος, μόνο αν δεν τον έχετε δηλώσει ήδη ή αν άλλαξε.", en: "IBAN of an account in your name, only if you have not declared it before or it changed." },
    { el: "Οι ημέρες ασφάλισης αντλούνται αυτεπάγγελτα (Μίτος).", en: "Insured days are retrieved automatically (Mitos)." },
  ],
  steps: [
    { confirmed: true,
      text: { el: "Εγγραφείτε στο μητρώο ανέργων και αποκτήστε Δελτίο Ανεργίας από τις e-υπηρεσίες της ΔΥΠΑ με τους κωδικούς TAXISnet.", en: "Register as unemployed and get an unemployment card on ΔΥΠΑ's e-services with your TAXISnet credentials." },
      details: [
        { el: "Η εγγραφή γίνεται ηλεκτρονικά, χωρίς αυτοπρόσωπη προσέλευση.", en: "Registration is online; you do not need to visit an office." },
        { el: "Στην «Υποβολή ηλεκτρονικής αίτησης εγγραφής» επιλέγετε το ΚΠΑ2 του τόπου κατοικίας σας.", en: "Under «Υποβολή ηλεκτρονικής αίτησης εγγραφής» (online registration) you choose the ΚΠΑ2 office for where you live." },
      ] },
    { confirmed: true,
      text: { el: "Υποβάλετε την αίτηση μέσα σε 60 ημέρες από την επομένη της λήξης ή λύσης της εργασίας σας.", en: "Apply within 60 days from the day after your employment ended." } },
    { confirmed: true,
      text: { el: "Συνδεθείτε στις e-υπηρεσίες της ΔΥΠΑ ή στην υπηρεσία «Αίτηση επιδόματος ανεργίας» του gov.gr με τους κωδικούς TAXISnet.", en: "Log in to ΔΥΠΑ's e-services or to the gov.gr service «Αίτηση επιδόματος ανεργίας» (unemployment benefit application) with your TAXISnet credentials." } },
    { confirmed: true,
      text: { el: "Επιλέξτε «ΥΠΟΒΟΛΗ ΑΙΤΗΣΗΣ» και στη συνέχεια «ΑΙΤΗΣΗ ΤΑΚΤΙΚΗΣ ΕΠΙΔΟΤΗΣΗΣ ΑΝΕΡΓΙΑΣ».", en: "Choose «ΥΠΟΒΟΛΗ ΑΙΤΗΣΗΣ» (submit application) and then «ΑΙΤΗΣΗ ΤΑΚΤΙΚΗΣ ΕΠΙΔΟΤΗΣΗΣ ΑΝΕΡΓΙΑΣ» (regular unemployment benefit application)." } },
    { confirmed: true,
      text: { el: "Δηλώστε τα προστατευόμενα μέλη, τον λογαριασμό πληρωμής και ό,τι επιπλέον σας ζητηθεί. Κατά την υποβολή ενημερώνεστε για τους όρους και τις υποχρεώσεις σας και υπογράφετε υπεύθυνη δήλωση του ν. 1599/1986.", en: "Declare any dependent family members, your payment account and anything else requested. While submitting you are told the conditions and your obligations and sign a solemn declaration under Law 1599/1986." } },
    { confirmed: false,
      text: { el: "Ελέγξτε τα στοιχεία πριν από την οριστική υποβολή.", en: "Check your details before final submission." } },
    { confirmed: false,
      text: { el: "Κρατήστε το αποδεικτικό ή τον αριθμό της αίτησης.", en: "Keep the receipt or the application number." } },
    { confirmed: false,
      text: { el: "Παρακολουθήστε την πορεία της αίτησης στις e-υπηρεσίες της ΔΥΠΑ.", en: "Follow your application's progress on ΔΥΠΑ's e-services." } },
  ],
  timing: {
    el: "Η αίτηση υποβάλλεται μέσα σε 60 ημέρες από την επομένη της λήξης ή λύσης της εργασίας. Το Δελτίο Ανεργίας ισχύει τρεις μήνες και ανανεώνεται από 20 ημέρες πριν λήξει. Χρόνος διεκπεραίωσης κατά τον Μίτο: 3 μήνες.",
    en: "Apply within 60 days from the day after your employment ended. The unemployment card is valid for three months and can be renewed from 20 days before it expires. Processing time according to Mitos: 3 months.",
  },
  applyUrl: G,
  afterSubmission: [
    { el: "Η υπηρεσία ελέγχει τα στοιχεία. Αν λείπει κάτι, έχετε 20 ημέρες να το προσκομίσετε· αλλιώς μπορεί να εκδοθεί απορριπτική απόφαση μετά από 3 μήνες.", en: "The office checks your details. If something is missing you have 20 days to provide it; otherwise a rejection may follow after 3 months." },
    { el: "Η εγκριτική απόφαση ορίζει τη διάρκεια, το ποσό και τους μήνες παρουσίας. Κατά της απορριπτικής απόφασης μπορείτε να υποβάλετε ενδικοφανή προσφυγή (Μίτος).", en: "An approval sets the duration, the amount and your attendance months. Against a rejection you can file an administrative appeal (Mitos)." },
    { el: "Κάνετε «δήλωση παρουσίας» τον τρίτο μήνα κάθε τριμήνου. Αν λείψει για δύο συνεχόμενους μήνες παρουσίας, η επιδότηση αναστέλλεται.", en: "Make an attendance declaration in the third month of each quarter. If it is missed for two consecutive attendance months, the benefit is suspended." },
    { el: "Το επίδομα πιστώνεται μηνιαία στον λογαριασμό σας.", en: "The benefit is paid into your account monthly." },
  ],
  mistakes: [
    { el: "Η προθεσμία των 60 ημερών μετρά από την επομένη της λήξης της εργασίας· μην περιμένετε τελευταία στιγμή.", en: "The 60 days count from the day after your job ended; don't leave it to the last moment." },
    { el: "Αν δεν ανανεώσετε το Δελτίο Ανεργίας εγκαίρως, διαγράφεται αυτόματα.", en: "If you don't renew the unemployment card in time, it is deleted automatically." },
    { el: "Αν βρείτε εργασία ή αλλάξει κάτι, ενημερώστε τη ΔΥΠΑ μέσα σε 8 εργάσιμες ημέρες. Ποσά που καταβλήθηκαν αχρεωστήτως επιστρέφονται.", en: "If you find work or something changes, tell ΔΥΠΑ within 8 working days. Amounts paid when you were not entitled must be repaid." },
    { el: "Ο λογαριασμός πληρωμής πρέπει να είναι στο όνομά σας ως δικαιούχου.", en: "The payment account must be in your name." },
    { el: "Το Jackal Accountant δεν υποβάλλει αιτήσεις και δεν ζητά ποτέ κωδικούς TAXISnet.", en: "Jackal Accountant never submits applications and never asks for TAXISnet credentials." },
  ],
  faq: [
    { q: { el: "Μπορώ να κάνω αίτηση αν παραιτήθηκα;", en: "Can I apply if I resigned?" },
      a: { el: "Η επίσημη σελίδα αναφέρει σχέση εργασίας που έληξε ή καταγγέλθηκε από τον εργοδότη. Για τη δική σας περίπτωση απευθυνθείτε στο ΚΠΑ2 της ΔΥΠΑ.", en: "The official page refers to employment that ended or was terminated by the employer. For your own case, ask ΔΥΠΑ's ΚΠΑ2 office." } },
    { q: { el: "Πόσο διαρκεί η επιδότηση;", en: "How long is the benefit paid?" },
      a: { el: "Για 125–149 ημέρες: 5 μήνες· 150–179: 6· 180–219: 8· 220–249: 10· 250 και άνω: 12 μήνες (πίνακας 1.Α της ΔΥΠΑ για το 14μηνο). Για τη διετία και τους οικοδόμους ισχύουν άλλοι πίνακες.", en: "125–149 days: 5 months; 150–179: 6; 180–219: 8; 220–249: 10; 250 or more: 12 months (ΔΥΠΑ table 1.A, 14-month period). Other tables apply to the two-year period and to construction workers." } },
    { q: { el: "Τι είναι το νέο πιλοτικό επίδομα ανεργίας;", en: "What is the new pilot unemployment benefit?" },
      a: { el: "Από το 2025 εφαρμόζεται πιλοτικά νέο επίδομα σε τυχαία επιλεγμένους δικαιούχους, με άλλο ποσό και διάρκεια. Η αίτηση είναι η ίδια. Οι όροι του δεν περιγράφονται σε αυτόν τον οδηγό.", en: "Since 2025 a new benefit is piloted for randomly selected claimants, with a different amount and duration. The application is the same. Its terms are not covered in this guide." } },
  ],
  sections: [],
  sources: [
    { label: "ΔΥΠΑ — Ανεργία & Παροχές Ασφάλισης Μισθωτών", url: D1 },
    { label: "ΔΥΠΑ — Εγγραφή στο Μητρώο Ανέργων, Δελτία Ανεργίας", url: D3 },
    { label: "Μίτος — Τακτική Επιδότηση Ανεργίας (ενημ. 14/10/2026)", url: M },
    { label: "gov.gr — Αίτηση επιδόματος ανεργίας", url: G },
    { label: "ΔΥΠΑ — Unemployment & insurance benefits of employees (English)", url: D2 },
    { label: "Υπουργείο Εργασίας — νέο επίδομα ανεργίας (πιλοτικό, 23/12/2024)", url: Y },
  ],
  checkedOn: "2026-10-16",
  reviewAfterDays: 30,
  limitations: [
    { el: "Τα ποσά διαφέρουν μεταξύ της ελληνικής σελίδας της ΔΥΠΑ (ανώτερο 565,00 €) και της αγγλικής (ανώτερο 479,00 €). Ο οδηγός δείχνει την ελληνική σελίδα· η τελική επιβεβαίωση ανήκει στη ΔΥΠΑ.", en: "Amounts differ between ΔΥΠΑ's Greek page (top band €565.00) and its English page (top band €479.00). This guide shows the Greek page; ΔΥΠΑ is responsible for confirming." },
    { el: "Η ελληνική σελίδα αναφέρει ότι η αίτηση γίνεται «μόνο» ηλεκτρονικά, αλλά και ότι μπορεί να γίνει αυτοπροσώπως στο ΚΠΑ2. Ρωτήστε το ΚΠΑ2 σας αν χρειάζεστε αυτοπρόσωπη εξυπηρέτηση.", en: "The Greek page says applications are made «only» online, but also that you can apply in person at a ΚΠΑ2 office. Ask your ΚΠΑ2 office if you need in-person help." },
    { el: "Για το πιλοτικό νέο επίδομα οι επίσημες πηγές αναφέρουν διάρκεια έως 16 μήνες (ανακοίνωση) ή έως 24 (συχνές ερωτήσεις).", en: "For the pilot new benefit, official sources give a duration of up to 16 months (announcement) or up to 24 (FAQ)." },
    { el: "Οι οθόνες μετά την επιλογή της αίτησης δεν έχουν επιβεβαιωθεί με στιγμιότυπα· τα αντίστοιχα βήματα σημειώνονται.", en: "The screens after choosing the application have not been confirmed with screenshots; those steps are marked." },
  ],
  recordKey: "manual:unemployment",
  related: ["unemployment", "applying-officially"],
  flags: { draft: true, conflicting: true, incomplete: false, possiblyOutdated: false, educational: false },
};
