import type { LocaleMessages } from "@/locales/schema";

export const viReport: LocaleMessages["report"] = {
  page: {
    badge: "Báo cáo ngày",
    title: "Biến dữ liệu tư thế thành một bản tóm tắt dễ xem và có động lực.",
    description:
      "Màn hình này thể hiện cả hai trạng thái chính của bản demo: báo cáo đã có dữ liệu và trạng thái chưa có dữ liệu nhưng vẫn hữu ích, vẫn đủ đẹp.",
    loadedCta: "Đã có báo cáo",
    emptyCta: "Chưa có dữ liệu",
  },
  overview: {
    scoreEyebrow: "Tổng quan điểm số",
    todayLabel: "Hôm nay",
    todayNote: "Ổn định hơn, dễ chịu hơn và đang đi lên.",
    deltaLabel: "So với hôm qua",
    deltaNote: "Bạn chỉnh lại nhanh hơn sau các lần được nhắc.",
    bestWindowLabel: "Khung giờ tốt nhất",
    recoveryMinutesLabel: "Phút phục hồi",
    ratioEyebrow: "Tỷ lệ tư thế",
    ratioTitle: "Phần lớn phiên làm việc hôm nay giữ được tư thế tốt",
    ratio: [
      { name: "Tốt", value: 58, fill: "#34d399" },
      { name: "Cần chỉnh", value: 28, fill: "#fb923c" },
      { name: "Lệch nhiều", value: 14, fill: "#f87171" },
    ],
    sittingEyebrow: "Phân bổ thời gian ngồi",
    sittingTitle: "Ngày làm việc của bạn được chia như thế nào",
    sittingBreakdown: [
      { label: "Ngồi tập trung", minutes: 168, fill: "#7dd3fc" },
      { label: "Khoảng nghỉ phục hồi", minutes: 41, fill: "#34d399" },
      { label: "Khoảng thời gian cần chỉnh", minutes: 34, fill: "#fb923c" },
      { label: "Thời gian lệch nhiều", minutes: 17, fill: "#f87171" },
    ],
    todayScore: 84,
    deltaVsYesterday: 6,
    bestWindow: "2:00 PM - 4:00 PM",
    recoveryMinutes: 11,
  },
  insights: {
    insightsEyebrow: "Nhận định dành riêng cho bạn",
    insightsTitle: "Điều gì nổi bật trong hôm nay",
    cards: [
      {
        title: "Khung giờ tốt nhất",
        description: "Tư thế của bạn vững nhất sau bữa trưa, khi độ cao màn hình đã được chỉnh lại.",
        stat: "Điểm trung bình 91",
      },
      {
        title: "Thói quen nên để ý",
        description: "Đầu vẫn có xu hướng lao về trước khi bạn chuyển từ ghi chú sang gõ bàn phím.",
        stat: "3 đợt tăng cảnh báo",
      },
      {
        title: "Bạn đang tiến bộ rõ rệt",
        description: "Tốc độ chỉnh lại đã nhanh hơn, cho thấy vòng lặp nhắc và phản hồi đang bắt đầu phát huy tác dụng.",
        stat: "Trung bình 18 giây",
      },
    ],
    tomorrowEyebrow: "Gợi ý cho ngày mai",
    tomorrowTitle: "Một vài điều đơn giản để giữ đà cải thiện",
    recommendations: [
      {
        title: "Nâng laptop thêm 4 cm",
        description: "Góc màn hình cao hơn một chút sẽ giúp giảm cảnh báo đầu tiên vào buổi sáng.",
        time: "Trước 9:00 sáng",
      },
      {
        title: "Cài một lần giãn nhẹ sau 45 phút",
        description: "Đó là thời điểm vai thường bắt đầu căng lên rõ nhất.",
        time: "10:45 sáng",
      },
      {
        title: "Giữ chế độ nhắc bằng giọng hỗ trợ",
        description: "Cách nhắc này giúp bạn chỉnh nhanh hơn mà không làm đứt mạch tập trung.",
        time: "Cả ngày",
      },
    ],
  },
  noData: {
    eyebrow: "Chưa có dữ liệu",
    title: "Báo cáo sẽ thật sự hữu ích sau vài phiên ngồi có hướng dẫn.",
    description:
      "Trạng thái rỗng này cũng là một phần của MVP. Nó giúp người dùng yên tâm, hiểu điều gì sẽ được mở tiếp theo và có đường quay lại trải nghiệm nhắc tư thế trực tiếp thật rõ ràng.",
    primaryCta: "Bắt đầu một phiên trực tiếp",
    secondaryCta: "Xem các bài phục hồi",
    steps: [
      "Ghi lại phiên tư thế đầu tiên của bạn",
      "Để ứng dụng bắt đầu so sánh các mẫu ngồi",
      "Mở khóa gợi ý cho ngày mai",
    ],
  },
};
