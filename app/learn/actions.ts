"use server";

import { revalidatePath } from "next/cache";
import { lmsPrisma } from "@/lib/lms/prisma";
import { ensureStudent } from "@/lib/lms/progress";

/**
 * Mark a lesson done (done=true) or not done (done=false) for the current
 * student. Idempotent: the unique [studentId, lessonSlug] makes repeat
 * "done" a no-op; "not done" removes the row.
 */
export async function toggleLesson(slug: string, done: boolean) {
  const userId = await ensureStudent();
  if (!userId) throw new Error("Not authenticated");

  if (done) {
    await lmsPrisma.lessonProgress.upsert({
      where: { studentId_lessonSlug: { studentId: userId, lessonSlug: slug } },
      create: { studentId: userId, lessonSlug: slug },
      update: {},
    });
  } else {
    await lmsPrisma.lessonProgress.deleteMany({
      where: { studentId: userId, lessonSlug: slug },
    });
  }

  revalidatePath("/learn");
  revalidatePath(`/learn/${slug}`);
}
