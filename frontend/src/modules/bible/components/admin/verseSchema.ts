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
    verseReference: z
      .string()
      .min(1, t("admin.form.validation.verseRefRequired"))
      .max(120, t("admin.form.validation.verseRefMax")),
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
    translation: z.string().optional().or(z.literal("")),
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
