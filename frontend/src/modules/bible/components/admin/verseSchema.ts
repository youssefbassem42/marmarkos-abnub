import { z } from "zod";
import type { TFunction } from "i18next";

export const BIBLE_BOOKS = [
  "Genesis",
  "Exodus",
  "Leviticus",
  "Numbers",
  "Deuteronomy",
  "Joshua",
  "Judges",
  "Ruth",
  "1 Samuel",
  "2 Samuel",
  "1 Kings",
  "2 Kings",
  "1 Chronicles",
  "2 Chronicles",
  "Ezra",
  "Nehemiah",
  "Esther",
  "Job",
  "Psalms",
  "Proverbs",
  "Ecclesiastes",
  "Song of Solomon",
  "Isaiah",
  "Jeremiah",
  "Lamentations",
  "Ezekiel",
  "Daniel",
  "Hosea",
  "Joel",
  "Amos",
  "Obadiah",
  "Jonah",
  "Micah",
  "Nahum",
  "Habakkuk",
  "Zephaniah",
  "Haggai",
  "Zechariah",
  "Malachi",
  "Matthew",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Romans",
  "1 Corinthians",
  "2 Corinthians",
  "Galatians",
  "Ephesians",
  "Philippians",
  "Colossians",
  "1 Thessalonians",
  "2 Thessalonians",
  "1 Timothy",
  "2 Timothy",
  "Titus",
  "Philemon",
  "Hebrews",
  "James",
  "1 Peter",
  "2 Peter",
  "1 John",
  "2 John",
  "3 John",
  "Jude",
  "Revelation",
] as const;

export type BibleBookEnglish = (typeof BIBLE_BOOKS)[number];

export const BIBLE_BOOKS_AR: Record<BibleBookEnglish, string> = {
  "Genesis": "تَكْوِين",
  "Exodus": "خُرُوج",
  "Leviticus": "لَاوِيِّين",
  "Numbers": "عَدَّ",
  "Deuteronomy": "تَثْلِيث",
  "Joshua": "يَشُوع",
  "Judges": "قُضَاة",
  "Ruth": "رُوث",
  "1 Samuel": "صَمُوِيل ١",
  "2 Samuel": "صَمُوِيل ٢",
  "1 Kings": "مُلُوك ١",
  "2 Kings": "مُلُوك ٢",
  "1 Chronicles": "أَخْبَار ١",
  "2 Chronicles": "أَخْبَار ٢",
  "Ezra": "عِزْرَا",
  "Nehemiah": "نَحَمْيَا",
  "Esther": "أَسْتِير",
  "Job": "أَيُّوب",
  "Psalms": "مَزَامِير",
  "Proverbs": "أَمْثَال",
  "Ecclesiastes": "جَامِعَة",
  "Song of Solomon": "نشيد الأنشاد",
  "Isaiah": "إِشَعْيَا",
  "Jeremiah": "إِرْمِيَا",
  "Lamentations": "رُثَاء",
  "Ezekiel": "حِزْقِيْل",
  "Daniel": "دَانِيَال",
  "Hosea": "هُوشَع",
  "Joel": "يُوِيل",
  "Amos": "عَامُوس",
  "Obadiah": "عُوبَدْيَا",
  "Jonah": "يُونَان",
  "Micah": "مِيكَا",
  "Nahum": "نَاحُوم",
  "Habakkuk": "حَبَقُّوق",
  "Zephaniah": "صَفَنْيَا",
  "Haggai": "حَجَّي",
  "Zechariah": "زَكَرِيَّا",
  "Malachi": "مَلَاخِي",
  "Matthew": "مَتَّى",
  "Mark": "مُرْقُس",
  "Luke": "لُوقَا",
  "John": "يُوحَنَّا",
  "Acts": "أَعْمَال",
  "Romans": "رُومِيَّة",
  "1 Corinthians": "1 كُورِنْثِيُّون",
  "2 Corinthians": "2 كُورِنْثِيُّون",
  "Galatians": "غَلَاتِيَة",
  "Ephesians": "أَفَسُس",
  "Philippians": "فِلِبِّي",
  "Colossians": "كُولُوسِي",
  "1 Thessalonians": "1 تَسَلُّونِيْكِي",
  "2 Thessalonians": "2 تَسَلُّونِيْكِي",
  "1 Timothy": "1 تِيمُوثَاوُس",
  "2 Timothy": "2 تِيمُوثَاوُس",
  "Titus": "تِيطُس",
  "Philemon": "فِلِمُون",
  "Hebrews": "العِبْرَانِيُّون",
  "James": "يَعْقُوب",
  "1 Peter": "1 بُطْرُس",
  "2 Peter": "2 بُطْرُس",
  "1 John": "1 يُوحَنَّا",
  "2 John": "2 يُوحَنَّا",
  "3 John": "3 يُوحَنَّا",
  "Jude": "يَهُوذَا",
  "Revelation": "رُؤْيَا يُوحَنَّا",
};

/** Generate an Arabic verse reference like "إنجيل متّى 6:25-34" */
export function generateVerseRef(
  book: BibleBookEnglish | string,
  chapter: number,
  verseStart: number,
  verseEnd?: number | null,
): string {
  const bookAr = BIBLE_BOOKS_AR[book as BibleBookEnglish] ?? book;
  const range =
    verseEnd != null && verseEnd !== verseStart
      ? `${verseStart}-${verseEnd}`
      : `${verseStart}`;
  return `${bookAr} ${chapter}:${range}`;
}

export type VerseFormValues = z.infer<ReturnType<typeof createVerseSchema>>;

export function createVerseSchema(t: TFunction<["bible"]>) {
  return z.object({
    title: z
      .string()
      .min(1, t("admin.form.validation.titleRequired"))
      .max(100, t("admin.form.validation.titleMax")),
    subtitle: z
      .string()
      .max(200, t("admin.form.validation.subtitleMax"))
      .optional()
      .or(z.literal("")),
    book: z.string().min(1, t("admin.form.validation.bookRequired")),
    chapter: z
      .coerce
      .number({ message: t("admin.form.validation.chapterRequired") })
      .min(1, t("admin.form.validation.chapterMin"))
      .max(150, t("admin.form.validation.chapterMax")),
    verseStart: z
      .coerce
      .number({ message: t("admin.form.validation.verseStartRequired") })
      .min(1, t("admin.form.validation.verseStartMin"))
      .max(150, t("admin.form.validation.verseStartMax")),
    verseEnd: z.coerce.number().min(1).max(150).optional().nullable(),
    text: z.string().min(1, t("admin.form.validation.textRequired")),
    reflection: z.string().optional().or(z.literal("")),
    image: z.string().url(t("admin.form.validation.imageInvalid")).optional().or(z.literal("")),
    status: z.enum(["DRAFT", "PUBLISHED"]),
  }).refine(
    (data) => {
      if (data.verseEnd != null && data.verseEnd !== 0) {
        return data.verseEnd >= data.verseStart;
      }
      return true;
    },
    { message: t("admin.form.validation.verseEndMin"), path: ["verseEnd"] },
  );
}
