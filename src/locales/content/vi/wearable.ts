import type { LocaleMessages } from "@/locales/schema";

export const viWearable: LocaleMessages["wearable"] = {
  companion: {
    eyebrow: "ActiveComfort Hybrid Pro",
    title: "Thiết Bị Hỗ Trợ",
    description: "Hướng dẫn haptic vật lý qua 4 vùng chính xác trên dây đai.",
    viewCta: "Xem thiết bị",
    postureStateLabel: "Trạng thái thiết bị",
    activeZonesLabel: "Vùng đang hoạt động",
    noActiveZonesLabel: "Tư thế ổn định",
    disconnectedLabel: "Chưa kết nối",
    disconnectedDescription:
      "Thiết bị đeo chưa được kết nối. Camera vẫn theo dõi tư thế; phản hồi haptic sẽ khả dụng khi phần cứng được ghép đôi.",
    disconnectedZonesLabel: "Thiết bị chưa kết nối",
    correctionLabel: "Chỉnh tốt",
    correctionDescription: "Dây đai nháy xanh để mô phỏng khoảnh khắc cơ thể quay về tư thế khỏe hơn.",
    tensionLabel: "Đang hỗ trợ",
    tensionDescription: "Các vùng hỗ trợ thích ứng sáng màu hổ phách khi tải kéo dài cần lực dẫn nhẹ.",
    loadLabel: "tải tư thế",
    noLoadLabel: "Đang chờ tải trực tiếp",
    disconnectedLoadLabel: "Chưa nhận dữ liệu thiết bị",
  },
  page: {
    badge: "ActiveComfort Hybrid Pro",
    title: "Gặp gỡ",
    titleHighlight: "dây đai tư thế",
    description:
      "Thiết bị đeo duy nhất kết hợp coaching AI thời gian thực với phản hồi haptic thông minh — giúp cơ thể học đúng tư thế một cách tự nhiên.",
    ctaDashboard: "Mở dashboard",
    rotateTip: "Kéo để xoay · Cuộn để phóng to",
    zoneSelectLabel: "Khám phá các vùng",
  },
  zones: {
    centerBack: {
      name: "Module Trung Tâm",
      badge: "Lưng Trên",
      description: "Bộ phận haptic chính. Phát rung chính xác khi đầu đưa trước và thân người nghiêng.",
      detail:
        "Chứa bộ xử lý chính, cảm biến IMU 6 trục, và các bộ phát rung chính. Kích hoạt khi phát hiện đầu đưa về trước hoặc thân người nghiêng.",
    },
    leftShoulder: {
      name: "Vai Trái",
      badge: "Vùng Vai",
      description: "Phát hiện và chỉnh lệch vai bất đối xứng và nghiêng ngang.",
      detail:
        "Vùng haptic phụ. Kích hoạt khi vai bị lệch. Phối hợp với vùng vai phải để chỉnh đối xứng hai bên.",
    },
    rightShoulder: {
      name: "Vai Phải",
      badge: "Vùng Vai",
      description: "Đối xứng với vùng vai trái — hoàn chỉnh cân bằng tư thế hai bên.",
      detail:
        "Vùng haptic phụ. Đối xứng vai trái. Cả hai vùng vai cùng cung cấp phản hồi chỉnh cân bằng thời gian thực.",
    },
    frontChest: {
      name: "Dây Trước",
      badge: "Cố Định",
      description: "Dây cố định phía trước neo dây đai và hỗ trợ tư thế ngực mở.",
      detail:
        "Cung cấp hỗ trợ căng cơ học. Kích hoạt khi đầu đưa trước để nhắc cơ thể giữ ngực thẳng.",
    },
  },
  productZones: {
    shoulderStraps: {
      name: "Dây Vai",
      badge: "Đối xứng chuyển động",
      description:
        "Hai dây vai theo dõi lệch bất đối xứng và phát phản hồi haptic đúng từng bên.",
      detail:
        "Mỗi dây tương ứng một kênh haptic ở vai. Khi một bên vai nâng hoặc cuộn, đúng bên đó sẽ pulse thay vì làm sáng toàn bộ dây đai.",
      activatesFor: "Lệch vai trái hoặc phải",
    },
    coreModule: {
      name: "Module Lưng Trên",
      badge: "IMU + BLE + haptic",
      description:
        "Module trung tâm chứa cảm biến chuyển động, đồng bộ không dây, bộ điều khiển rung và pin.",
      detail:
        "Đây là điểm phản hồi chính cho đầu đưa ra trước và nghiêng thân, giúp người dùng cảm nhận hướng dẫn ngay giữa hai bả vai.",
      activatesFor: "Đầu đưa ra trước, nghiêng thân, chỉnh tốt",
    },
    frontStabilization: {
      name: "Dây Cố Định Trước",
      badge: "Neo cân bằng",
      description:
        "Dây trước giữ dây đai ổn định để phản hồi haptic rơi đúng vị trí khi làm việc ở bàn.",
      detail:
        "Vùng này hỗ trợ mở ngực về mặt cơ học, còn tín hiệu haptic cho đầu đưa ra trước vẫn tập trung ở module lưng trên.",
      activatesFor: "Mở ngực và cân bằng dây đai",
    },
    adaptiveSupport: {
      name: "Vùng Hỗ Trợ Thích Ứng",
      badge: "Semi-active assist",
      description:
        "Các vùng căng bán chủ động mô phỏng lực dẫn nhẹ đưa cơ thể về lại sau khi gù hoặc giữ tải quá lâu.",
      detail:
        "Khi static hold, high exposure hoặc nghiêng thân kéo dài, vùng này pulse màu hổ phách để thể hiện tension assist thay vì chỉ rung.",
      activatesFor: "Giữ tĩnh, nghiêng thân, tải cao",
    },
  },
  features: {
    eyebrow: "Tính năng thiết bị",
    title: "Dây đai hoạt động như thế nào",
    description: "Ba lớp tích hợp xây dựng thói quen tư thế bền vững — haptic, cơ học và hành vi.",
    items: [
      {
        badge: "Lớp 1",
        title: "Nhận Thức",
        description:
          "Rung haptic nhẹ nhàng đúng vùng cần chỉnh — phản hồi tức thì ở cấp độ cơ thể, không cần nhìn màn hình.",
      },
      {
        badge: "Lớp 2",
        title: "Hướng Dẫn Cơ Học",
        description:
          "Hỗ trợ căng thông minh hướng dẫn cơ thể về đúng tư thế khi bạn ngồi và làm việc.",
      },
      {
        badge: "Lớp 3",
        title: "Củng Cố Hành Vi",
        description:
          "AI coaching đồng bộ dữ liệu phiên để củng cố thói quen tư thế tốt theo thời gian.",
      },
      {
        badge: "Chính Xác",
        title: "4 Vùng Haptic",
        description:
          "Module trung tâm, hai vai, và dây trước — bao phủ toàn thân trên cho mọi vấn đề tư thế.",
      },
    ],
  },
  landing: {
    eyebrow: "Thiết bị đeo vật lý",
    badge: "ActiveComfort Hybrid Pro",
    title: "Coaching tư thế mà",
    titleHighlight: "bạn cảm nhận được",
    description:
      "AI quan sát. Dây đai phản hồi. Bốn vùng haptic chính xác cung cấp chỉnh sửa thời gian thực đúng nơi cơ thể cần — không màn hình, không xao nhãng.",
    cta: "Khám phá thiết bị",
    secondaryCta: "Bắt đầu coaching",
    keyPoints: [
      {
        title: "4 Vùng Haptic",
        description: "Rung có mục tiêu cho lưng trên, vai và ngực.",
      },
      {
        title: "Đồng Bộ AI",
        description: "Dữ liệu tư thế trực tiếp kích hoạt các vùng theo thời gian thực.",
      },
      {
        title: "Căng Thích Ứng",
        description: "Hướng dẫn cơ học tự động hỗ trợ căn chỉnh cơ thể.",
      },
    ],
  },
  story: {
    eyebrow: "Mô phỏng thực tế",
    steps: [
      {
        title: "Thiết bị xuất hiện",
        description: "Model 3D chạy trực tiếp trong trình duyệt để người dùng khám phá dây đai trước khi có prototype vật lý.",
        metric: "3D product",
      },
      {
        title: "Cảm nhận mọi chuyển động",
        description: "Module trung tâm là hub cảm biến: IMU, Bluetooth, bộ điều khiển haptic và pin trong một cụm ở lưng trên.",
        metric: "Core module",
      },
      {
        title: "Biết chính xác bạn lệch ở đâu",
        description: "Các điểm haptic sáng lên đúng vùng vai hoặc lưng trên tương ứng với lỗi tư thế mà AI phát hiện.",
        metric: "4 vùng haptic",
      },
      {
        title: "Dẫn bạn quay lại nhẹ nhàng",
        description: "Vùng hỗ trợ thích ứng pulse màu hổ phách để mô phỏng lực căng bán chủ động khi tải kéo dài.",
        metric: "Assist active",
      },
      {
        title: "Theo dõi tiến bộ",
        description: "Điểm dashboard tăng khi tư thế hồi phục, nối camera intelligence với phản hồi wearable.",
        metric: "Score 92",
      },
    ],
  },
};
