import { describe, expect, it } from "vitest";

import i18n from "@/i18n";
import { ApiError, toApiError } from "@/lib/api";
import { describeApiError, type ErrorKind } from "@/lib/errorMessages";

const t = i18n.getFixedT(null, "errors");

interface CodeCase {
  code: string;
  status: number;
  kind: ErrorKind;
  message: string;
}

const CODE_CASES: CodeCase[] = [
  {
    code: "validation_error",
    status: 422,
    kind: "user",
    message: "البيانات المُدخلة غير صالحة. يرجى مراجعتها وحاول مرة أخرى.",
  },
  {
    code: "unauthorized",
    status: 401,
    kind: "user",
    message: "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى للمتابعة.",
  },
  {
    code: "forbidden",
    status: 403,
    kind: "user",
    message: "لا تملك الصلاحية اللازمة لتنفيذ هذا الإجراء.",
  },
  {
    code: "not_found",
    status: 404,
    kind: "user",
    message: "العنصر المطلوب غير موجود أو تم حذفه.",
  },
  {
    code: "conflict",
    status: 409,
    kind: "user",
    message: "تم تنفيذ هذا الإجراء بالفعل.",
  },
  {
    code: "rate_limited",
    status: 429,
    kind: "user",
    message: "لقد حاولت كثيرًا في وقت قصير. انتظر قليلًا ثم حاول مرة أخرى.",
  },
  {
    code: "email_not_verified",
    status: 403,
    kind: "user",
    message:
      "يجب تأكيد بريدك الإلكتروني أولًا. افتح رسالة التحقق المرسلة إليك.",
  },
  {
    code: "account_inactive",
    status: 403,
    kind: "user",
    message: "حسابك غير مفعّل. تواصل مع الإدارة لتفعيل الحساب.",
  },
  {
    code: "internal_error",
    status: 500,
    kind: "server",
    message:
      "حدث خطأ في الخادم. هذه المشكلة ليست من طرفك؛ يرجى المحاولة لاحقًا.",
  },
  {
    code: "invalid_status_transition",
    status: 409,
    kind: "user",
    message: "لا يمكن تغيير حالة هذه الآية الآن. راجع حالتها ثم حاول مرة أخرى.",
  },
  {
    code: "invalid_schedule",
    status: 422,
    kind: "user",
    message: "موعد الجدولة غير صالح. اختر تاريخًا ووقتًا صالحين.",
  },
  {
    code: "schedule_exists",
    status: 409,
    kind: "user",
    message: "هذه الآية مُجدولة بالفعل.",
  },
  {
    code: "quiz_exists",
    status: 409,
    kind: "user",
    message: "يوجد اختبار مرتبط بهذه الآية بالفعل.",
  },
  {
    code: "quiz_not_publishable",
    status: 422,
    kind: "user",
    message: "الاختبار غير جاهز للنشر. أكمل المتطلبات ثم حاول مرة أخرى.",
  },
  {
    code: "quiz_not_available",
    status: 403,
    kind: "user",
    message: "هذا الاختبار غير متاح حاليًا.",
  },
  {
    code: "verse_not_read",
    status: 403,
    kind: "user",
    message: "يجب تحديد الآية كمقروءة قبل بدء الاختبار.",
  },
  {
    code: "attempt_exists",
    status: 409,
    kind: "user",
    message: "لقد بدأت هذا الاختبار بالفعل. تابع المحاولة الحالية.",
  },
  {
    code: "budget_exhausted",
    status: 409,
    kind: "user",
    message: "انتهى الوقت المخصص للإجابة. سلّم إجاباتك الآن.",
  },
  {
    code: "attempt_finished",
    status: 409,
    kind: "user",
    message: "انتهت هذه المحاولة بالفعل.",
  },
  {
    code: "invalid_option",
    status: 422,
    kind: "user",
    message: "الخيار المحدد لا ينتمي إلى هذا السؤال.",
  },
  {
    code: "invalid_reorder",
    status: 422,
    kind: "user",
    message:
      "ترتيب الأسئلة المُرسل غير صالح. أعد ترتيب الأسئلة وحاول مرة أخرى.",
  },
  {
    code: "export_too_large",
    status: 413,
    kind: "user",
    message:
      "عدد الصفوف أكبر من المسموح للتصدير. ضيّق عوامل التصفية ثم حاول مرة أخرى.",
  },
  {
    code: "scheduler_disabled",
    status: 503,
    kind: "server",
    message:
      "حدث خطأ في الخادم. هذه المشكلة ليست من طرفك؛ يرجى المحاولة لاحقًا.",
  },
  {
    code: "invalid_response",
    status: 0,
    kind: "server",
    message:
      "حدث خطأ في الخادم. هذه المشكلة ليست من طرفك؛ يرجى المحاولة لاحقًا.",
  },
];

describe("the Arabic translator of API errors", () => {
  it.each(CODE_CASES)(
    "describes the backend code $code",
    ({ code, status, kind, message }) => {
      const described = describeApiError(
        new ApiError(status, "A machine reason that is not shown", code),
        t,
      );

      expect(described).toEqual({
        message,
        kind,
        code,
        ...(status > 0 ? { status } : {}),
      });
    },
  );

  it.each([
    [401, "user", "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى للمتابعة."],
    [403, "user", "لا تملك الصلاحية اللازمة لتنفيذ هذا الإجراء."],
    [404, "user", "العنصر المطلوب غير موجود أو تم حذفه."],
    [409, "user", "تم تنفيذ هذا الإجراء بالفعل."],
    [413, "user", "حجم البيانات أكبر من المسموح. قلّل حجمها وحاول مرة أخرى."],
    [422, "user", "البيانات المُدخلة غير صالحة. يرجى مراجعتها وحاول مرة أخرى."],
    [
      429,
      "user",
      "لقد حاولت كثيرًا في وقت قصير. انتظر قليلًا ثم حاول مرة أخرى.",
    ],
    [
      500,
      "server",
      "حدث خطأ في الخادم. هذه المشكلة ليست من طرفك؛ يرجى المحاولة لاحقًا.",
    ],
    [
      503,
      "server",
      "حدث خطأ في الخادم. هذه المشكلة ليست من طرفك؛ يرجى المحاولة لاحقًا.",
    ],
  ] as const)(
    "uses the HTTP status %s when the backend has no known code",
    (status, kind, message) => {
      const described = describeApiError(
        new ApiError(status, "An unknown server sentence"),
        t,
      );

      expect(described.kind).toBe(kind);
      expect(described.message).toBe(message);
      expect(described.status).toBe(status);
      expect(described.message).not.toContain("unknown server sentence");
    },
  );

  it("describes a transport failure as a connection problem", () => {
    const described = describeApiError(new Error("Network Error"), t);

    expect(described.kind).toBe("network");
    expect(described.message).toBe(
      "تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.",
    );
    expect(described.status).toBeUndefined();
    expect(described.message).not.toContain("Network Error");
  });

  it.each([
    [
      "Image must be 5 MB or smaller",
      "validation_error",
      "حجم الصورة أكبر من 5 ميغابايت. اختر صورة أصغر وحاول مرة أخرى.",
    ],
    [
      "The uploaded file is empty",
      "validation_error",
      "الملف الذي اخترته فارغ. اختر ملفًا آخر وحاول مرة أخرى.",
    ],
    [
      "Image upload failed; please try again",
      "validation_error",
      "فشل رفع الصورة. تأكد أن الملف صورة ثم حاول مرة أخرى.",
    ],
    [
      "The image service refused the credentials of the platform",
      "image_service_unavailable",
      "تعذّر على المنصة رفع الصورة لأن خدمة الصور رفضت بيانات الاعتماد. المشكلة عندنا، يرجى المحاولة بعد قليل.",
    ],
    [
      "This file is not an image",
      "validation_error",
      "الملف الذي اخترته ليس صورة. اختر ملفًا آخر وحاول مرة أخرى.",
    ],
    [
      "Invalid credentials",
      "unauthorized",
      "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    ],
    [
      "Account is not active",
      "forbidden",
      "حسابك غير مفعّل. تواصل مع الإدارة لتفعيل الحساب.",
    ],
    [
      "Email not verified",
      "email_not_verified",
      "يجب تأكيد بريدك الإلكتروني أولًا. افتح رسالة التحقق المرسلة إليك.",
    ],
    [
      "Not authenticated",
      "unauthorized",
      "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى للمتابعة.",
    ],
  ])(
    "turns the known server message %s into Arabic",
    (serverMessage, code, expected) => {
      const described = describeApiError(
        new ApiError(422, serverMessage, code),
        t,
      );

      expect(described.message).toBe(expected);
      expect(described.message).not.toBe(serverMessage);
      expect(described.message).not.toContain("Image must");
      expect(described.message).not.toContain("Invalid credentials");
    },
  );

  it("keeps the status, code and reason on the API failure", () => {
    const axiosFailure = {
      isAxiosError: true,
      message: "Request failed",
      response: {
        status: 422,
        data: {
          detail: {
            code: "validation_error",
            message: "Image must be 5 MB or smaller",
            data: { field: "file" },
          },
        },
      },
    };

    const apiError = toApiError(axiosFailure);

    expect(apiError.status).toBe(422);
    expect(apiError.code).toBe("validation_error");
    expect(apiError.message).toBe("Image must be 5 MB or smaller");
    expect(apiError.data).toEqual({ field: "file" });
  });
});
