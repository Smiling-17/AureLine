import type { Language } from "@/locales";
import type { FeedbackLevel, IssueFamily, LoadSource, TaskState } from "@/runtime/types";

interface CueCopyOptions {
  taskState?: TaskState;
  loadSource?: LoadSource | null;
}

type CueCopy = {
  title: string;
  detail: string;
  reward: string;
};

const genericLoadCopy: Record<Language, Record<LoadSource, CueCopy>> = {
  en: {
    deviation: {
      title: "Unload this position a bit",
      detail: "Change position, look up, and reset your shoulders before this load builds up further.",
      reward: "Nice reset. The load dropped and your posture looks easier now.",
    },
    "static-hold": {
      title: "Change position for a moment",
      detail: "You have held this position long enough. Look up, breathe, and move your shoulders or back.",
      reward: "Nice reset. You broke the long hold and gave your body a breather.",
    },
    compound: {
      title: "Reset the hold and the drift",
      detail: "This position is both held too long and drifting. Change position, look up, and restack gently.",
      reward: "Good recovery. You reduced both the hold and the drift.",
    },
  },
  vi: {
    deviation: {
      title: "Giảm tải tư thế này một chút",
      detail: "Đổi vị trí, ngẩng lên và thả vai trước khi tải tích lũy thêm.",
      reward: "Tốt lắm. Tải đã giảm và tư thế của bạn trông nhẹ hơn rồi.",
    },
    "static-hold": {
      title: "Đổi vị trí trong chốc lát",
      detail: "Bạn đã giữ nguyên tư thế này đủ lâu. Hãy ngẩng lên, thở đều và di chuyển vai hoặc lưng.",
      reward: "Rất ổn. Bạn đã phá được trạng thái giữ lâu và cho cơ thể nghỉ một chút.",
    },
    compound: {
      title: "Reset cả giữ lâu lẫn lệch dần",
      detail: "Tư thế này vừa bị giữ quá lâu vừa đang trôi khỏi vị trí thoải mái. Hãy đổi vị trí và xếp lại nhẹ nhàng.",
      reward: "Khá hơn nhiều rồi. Bạn đã giảm được cả trạng thái giữ lâu lẫn lệch dần.",
    },
  },
};

const issueCopy: Record<Language, Record<IssueFamily, Record<"default" | "readingLike", CueCopy>>> = {
  en: {
    "forward-head": {
      default: {
        title: "Look up and ease your head back",
        detail: "Bring your ears a little closer over your shoulders and let the jaw stay loose.",
        reward: "Nice reset. Your neck load looks lighter now.",
      },
      readingLike: {
        title: "Take a brief look up",
        detail: "This angle can make sense for the task, but it is time to unload your neck and upper back.",
        reward: "Good recovery. You gave your neck a break without forcing a rigid posture.",
      },
    },
    "torso-lean": {
      default: {
        title: "Restack your torso",
        detail: "Shift back into the chair or bring your ribs back over the hips for a moment.",
        reward: "Nice recovery. Your upper body looks more balanced now.",
      },
      readingLike: {
        title: "Give your back a reset",
        detail: "Writing or reading can pull you forward. Take a brief reset so the load does not keep building.",
        reward: "Good reset. Your back looks less loaded now.",
      },
    },
    "shoulder-tilt": {
      default: {
        title: "Reset your shoulders",
        detail: "Drop the raised shoulder, soften the upper traps, and let both arms settle.",
        reward: "Nice correction. Your shoulders look more even now.",
      },
      readingLike: {
        title: "Loosen the shoulder hold",
        detail: "One side is doing more work. Relax the shoulder and give both arms a small reset.",
        reward: "Good recovery. Your shoulders look less tense now.",
      },
    },
  },
  vi: {
    "forward-head": {
      default: {
        title: "Ngẩng lên và đưa đầu về nhẹ thôi",
        detail: "Đưa tai về gần trục vai hơn một chút và thả lỏng hàm.",
        reward: "Tốt lắm. Tải lên cổ trông nhẹ hơn rồi.",
      },
      readingLike: {
        title: "Ngẩng lên một nhịp ngắn",
        detail: "Góc này có thể hợp với task hiện tại, nhưng đã đến lúc giảm tải cho cổ và lưng trên.",
        reward: "Khá lắm. Bạn đã cho cổ được nghỉ mà không cần ép mình phải ngồi cứng.",
      },
    },
    "torso-lean": {
      default: {
        title: "Xếp lại thân trên",
        detail: "Tựa nhẹ về ghế hoặc đưa lồng ngực trở lại trên hông trong chốc lát.",
        reward: "Ổn hơn rồi. Thân trên của bạn trông cân hơn.",
      },
      readingLike: {
        title: "Cho lưng một nhịp reset",
        detail: "Viết hoặc đọc dễ kéo người về trước. Hãy reset ngắn để tải không tiếp tục tích lũy.",
        reward: "Rất ổn. Tải lên lưng đã giảm xuống.",
      },
    },
    "shoulder-tilt": {
      default: {
        title: "Reset lại hai vai",
        detail: "Hạ bên vai đang nâng, thả lỏng cổ vai và để hai tay nghỉ đều hơn.",
        reward: "Tốt lắm. Hai vai của bạn đã cân hơn rồi.",
      },
      readingLike: {
        title: "Nới lỏng phần giữ ở vai",
        detail: "Một bên đang làm việc nhiều hơn. Hãy thả vai và reset nhẹ cho cả hai tay.",
        reward: "Khá hơn nhiều. Phần vai trông bớt căng rồi.",
      },
    },
  },
};

const levelLabels: Record<Language, Record<FeedbackLevel, string>> = {
  en: {
    1: "Level 1",
    2: "Level 2",
    3: "Level 3",
    4: "Level 4",
  },
  vi: {
    1: "Mức 1",
    2: "Mức 2",
    3: "Mức 3",
    4: "Mức 4",
  },
};

function isReadingLikeTask(taskState?: TaskState) {
  return taskState === "reading" || taskState === "handwriting" || taskState === "phone-tablet";
}

export function getCueCopy(language: Language, issue: IssueFamily | null, options: CueCopyOptions = {}) {
  if (options.loadSource && (!issue || options.loadSource === "static-hold")) {
    return genericLoadCopy[language][options.loadSource];
  }

  if (!issue) {
    return genericLoadCopy[language][options.loadSource ?? "deviation"];
  }

  return issueCopy[language][issue][isReadingLikeTask(options.taskState) ? "readingLike" : "default"];
}

export function getLevelLabel(language: Language, level: FeedbackLevel) {
  return levelLabels[language][level];
}
