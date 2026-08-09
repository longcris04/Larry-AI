import React, { Suspense, useCallback, useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import Login from "./components/ui/Login";
import Register from "./components/ui/Register";
import ProtectedRoute from "./components/ui/ProtectedRoute";
import AdminRoute from "./components/ui/AdminRoute";
import AdminPage from "./components/ui/AdminPage";
import Camera from "./components/ui/Camera";
import ChatBox from "./components/ui/ChatBox";
import CheckinModal from "./components/ui/CheckinModal";
import KnowledgePanel from "./components/ui/KnowledgePanel";
import PlayfulBackground from "./components/ui/PlayfulBackground";
import UserMenu from "./components/ui/UserMenu";
import "./styles/larry.css";
// Nạp sau larry.css để phần màu theo agent ghi đè được màu mặc định của bong bóng
import "./styles/agents.css";

const ScratchGamePage = React.lazy(
  () => import("./components/ui/ScratchGamePage"),
);

// Đặt biến này trong frontend/.env để BỎ HẲN bước camera khi demo hoặc chạy thử
// tự động:
//   REACT_APP_FAKE_EMOTION=neutral
// Có sẵn cảm xúc nghĩa là bước nhận diện coi như xong, nên cột trái vào thẳng bảng
// tri thức và webcam không bật lần nào.
//
// Đây KHÔNG phải cách xử lý việc học sinh từ chối quyền camera — trường hợp đó
// Camera tự báo về qua onUnavailable và cuộc trò chuyện đi tiếp không cần cảm xúc.
const FAKE_EMOTION = process.env.REACT_APP_FAKE_EMOTION || "";

const ProtectedApp = () => {
  const [emotion, setEmotion] = useState(FAKE_EMOTION || null);

  // Camera không dùng được: học sinh không cho quyền, máy không có webcam, model
  // nhận diện hỏng, hoặc em chủ động bỏ qua. Bước camera vẫn tính là XONG — chỉ là
  // xong mà không có tín hiệu nào. Không tách khỏi `emotion` thì màn hình đứng lại
  // ở "Larry đang chờ nhìn thấy bạn" mãi mãi vì cảm xúc không bao giờ về.
  const [cameraOff, setCameraOff] = useState(false);

  // Phiếu cảm xúc hỏi lúc vừa vào chat. null = chưa trả lời / đã bỏ qua,
  // lúc đó system prompt giữ nguyên như cũ.
  const [checkin, setCheckin] = useState(null);
  const [checkinOpen, setCheckinOpen] = useState(true);

  // Tri thức agent vừa tra ở lượt gần nhất, do ChatBox đẩy lên. Nó thuộc về bảng
  // bên trái chứ không thuộc khung chat, nên state phải nằm ở đây.
  const [knowledgeView, setKnowledgeView] = useState({ knowledge: null, busy: false });

  const handleEmotionDetected = useCallback((detectedEmotion) => {
    setEmotion(detectedEmotion);
  }, []);

  const handleCameraUnavailable = useCallback((reason) => {
    console.info(`Bỏ qua bước camera (${reason}) — Larry sẽ hỏi để hiểu cảm xúc.`);
    setCameraOff(true);
  }, []);

  // Bước nhận diện đã kết thúc, dù chốt được cảm xúc hay không. Đây mới là thứ
  // quyết định lúc nào mở khung chat — KHÔNG phải bản thân cảm xúc.
  const emotionStepDone = Boolean(emotion) || cameraOff;

  const handleCheckinComplete = useCallback((answers) => {
    setCheckin(answers);
    setCheckinOpen(false);
  }, []);

  const handleCheckinSkip = useCallback(() => {
    setCheckinOpen(false);
  }, []);

  return (
    <ProtectedRoute>
      <div className="app-shell">
        <PlayfulBackground />

        {checkinOpen && (
          <CheckinModal
            onComplete={handleCheckinComplete}
            onSkip={handleCheckinSkip}
          />
        )}

        <div className="app-layout">
          <section className="panel-left">
            <div className="camera-stack">
              {/* Camera chỉ sống tới lúc xong bước nhận diện — chốt được cảm xúc,
                  hoặc xác định là không dùng được. Xong việc thì gỡ hẳn component
                  (webcam tắt theo) và nhường chỗ cho bảng tri thức — chỗ cho thấy
                  Larry lấy câu trả lời từ tài liệu nào. */}
              {emotionStepDone ? (
                <KnowledgePanel
                  knowledge={knowledgeView.knowledge}
                  busy={knowledgeView.busy}
                  emotion={emotion}
                  cameraOff={cameraOff}
                />
              ) : (
                <Camera
                  onEmotionDetected={handleEmotionDetected}
                  onUnavailable={handleCameraUnavailable}
                />
              )}
              <div className="camera-stack__menu">
                <UserMenu />
              </div>
            </div>
          </section>
          <section className="panel-right">
            <ChatBox
              emotion={emotion}
              emotionReady={emotionStepDone}
              checkin={checkin}
              checkinReady={!checkinOpen}
              onKnowledge={setKnowledgeView}
            />
          </section>
        </div>
      </div>
    </ProtectedRoute>
  );
};

const AppContent = () => {
  const { isAuthenticated, isAdmin, loading } = useAuth();

  // Đăng nhập bằng quyền quản trị thì vào thẳng khu vực quản trị
  const homePath = isAdmin ? "/admin" : "/";

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner"></div>
        <p>Đang tải...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to={homePath} replace /> : <Login />
        }
      />

      <Route
        path="/register"
        element={
          isAuthenticated ? <Navigate to={homePath} replace /> : <Register />
        }
      />

      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />
      <Route
        path="/game"
        element={
          <ProtectedRoute>
            <Suspense
              fallback={
                <div className="loading-screen">
                  <div className="spinner"></div>
                  <p>Đang mở Scratch...</p>
                </div>
              }
            >
              <ScratchGamePage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<ProtectedApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
