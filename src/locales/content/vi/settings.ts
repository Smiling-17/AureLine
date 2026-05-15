import type { LocaleMessages } from "@/locales/schema";

export const viSettings: LocaleMessages["settings"] = {
  page: {
    badge: "Cài đặt và riêng tư",
    title: "Cho người dùng quyền tinh chỉnh coach đến khi cảm thấy vừa hỗ trợ, vừa an toàn, vừa hợp với mình.",
    description:
      "Trang này gom độ nhạy nhắc, kiểu phản hồi, khoảng cách giữa các lần nhắc, phần giải thích riêng tư, niềm tin về xử lý cục bộ và lựa chọn giao diện vào một trung tâm điều khiển đủ cao cấp.",
    snapshotLabel: "Tóm tắt tùy chọn hiện tại",
  },
  feedback: {
    sensitivityEyebrow: "Độ nhạy phản hồi",
    sensitivityTitle: "Chỉnh mức chủ động của coach",
    sensitivityLabel: "Độ nhạy",
    sensitivityDescription: "Giá trị càng cao thì ứng dụng sẽ nhắc sớm hơn khi tư thế bắt đầu trôi đi.",
    sensitivityValueText: "trên thang 100",
    modeEyebrow: "Kiểu phản hồi",
    modeTitle: "Chọn cách ứng dụng lên tiếng",
    reminderEyebrow: "Khoảng cách nhắc nghỉ",
    reminderTitle: "Căn lời nhắc theo nhịp học và làm việc thật",
    positiveEyebrow: "Củng cố tích cực",
    positiveTitle: "Hiệu ứng thành tựu và ăn mừng nhỏ",
    positiveDescription: "Giữ những khoảnh khắc vui nhỏ khi người dùng thật sự xứng đáng được ghi nhận.",
    themeEyebrow: "Tùy chọn giao diện",
    themeTitle: "Chọn bầu không khí cho sản phẩm",
    reminderPresets: [
      { label: "Reset tập trung", minutes: 45 },
      { label: "Nhịp cân bằng", minutes: 50 },
      { label: "Làm sâu", minutes: 60 },
    ],
  },
  privacy: {
    explanationEyebrow: "Giải thích về riêng tư",
    explanationTitle: "Niềm tin được nói bằng ngôn ngữ đời thường",
    explanationDescription:
      "AI Posture Coach được định vị theo hướng ưu tiên riêng tư. Màn hình cài đặt này cho thấy cách xử lý cục bộ, lời nhắc có thể tinh chỉnh và các nút kiểm soát được đặt tên rõ ràng giúp sản phẩm tạo cảm giác tôn trọng, không xâm phạm.",
    localProcessingLabel: "Chế độ xử lý cục bộ",
    localProcessingDescription:
      "Giữ cách diễn giải rằng dữ liệu tư thế ở lại trên thiết bị và không lưu video hoặc ảnh.",
    remindersLabel: "Bật lời nhắc",
    remindersDescription:
      "Người dùng có thể tạm dừng lời nhắc bất cứ lúc nào mà không làm mất tiến bộ hay cảm giác tin tưởng vào sản phẩm.",
    trustEyebrow: "Bề mặt tạo niềm tin về xử lý cục bộ",
    trustTitle: "Người dùng nên cảm thấy gì ở đây",
    trustBullets: [
      "Sản phẩm này tôn trọng không gian của mình.",
      "Mình hoàn toàn kiểm soát được tần suất lời nhắc.",
      "Ứng dụng đang giúp mình cải thiện, chứ không phán xét mình.",
    ],
  },
};
