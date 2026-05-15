import type { LocaleMessages } from "@/locales/schema";

export const viDemoStates: LocaleMessages["demoStates"] = {
  posture: {
    good: {
      label: "TỐT",
      headline: "Tư thế đang rất ổn",
      detail: "Điều chỉnh vừa rồi khá đẹp. Vai đang cân hơn và góc cổ giữ ổn định.",
    },
    warning: {
      label: "CẦN CHỈNH",
      headline: "Đầu đang trôi về phía trước",
      detail: "Bạn đang hơi lao người lên trước. Hãy nâng màn hình lên hoặc tựa lưng lại một chút.",
    },
    bad: {
      label: "LỆCH NHIỀU",
      headline: "Lưng đang khum nhiều",
      detail: "Hãy dừng lại một chút để reset lưng và đưa đầu trở lại thẳng trên vai.",
    },
  },
  camera: {
    off: {
      label: "Camera tắt",
      description: "Xem trước trạng thái rỗng khi chưa bật nhận diện hoặc chưa cấp quyền camera.",
    },
    on: {
      label: "Camera bật",
      description:
        "Khung trực tiếp mô phỏng trải nghiệm coaching theo thời gian thực với overlay tư thế và phản hồi hỗ trợ.",
    },
    analyzing: {
      label: "Đang phân tích",
      description: "Dùng chế độ này để kiểm tra trạng thái tải và hiệu ứng khi hệ thống đang hiệu chỉnh.",
    },
  },
};
