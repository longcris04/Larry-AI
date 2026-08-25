import React, { Suspense, useCallback, useRef, useState } from "react";
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
import TeacherRoute from "./components/ui/TeacherRoute";
import TeacherPage from "./components/ui/TeacherPage";
import CounselorRoute from "./components/ui/CounselorRoute";
import CounselorPage from "./components/ui/CounselorPage";
import FeedbackLinks from "./components/ui/FeedbackLinks";
import AccountPill from "./components/ui/AccountPill";
import ChatBox from "./components/ui/ChatBox";
import CompanionPanel from "./components/ui/CompanionPanel";
import KnowledgePanel from "./components/ui/KnowledgePanel";
import PlayfulBackground from "./components/ui/PlayfulBackground";
import UserMenu from "./components/ui/UserMenu";
import { readSavedCharacterId, saveCharacterId } from "./constants/characters";
import { homePathForRole } from "./constants/roles";
import { useCompanionCamera } from "./hooks/useCompanionCamera";
import { useIntroScript } from "./hooks/useIntroScript";
import "./styles/larry.css";
// Nạp sau larry.css để phần màu theo agent ghi đè được màu mặc định của bong bóng
import "./styles/agents.css";

const ScratchGamePage = React.lazy(
  () => import("./components/ui/ScratchGamePage"),
);

// Trang giới thiệu tải riêng: nó kéo theo cả đồ thị kho tri thức, mà người đã
// đăng nhập vào thẳng khung chat thì không bao giờ mở tới.
const AboutPage = React.lazy(() => import("./components/ui/AboutPage"));

// Màn hình của học sinh chỉ có MỘT: khung chat.
//
// Lời chào và phiếu cảm xúc chạy ngay bên trong khung chat đó (useIntroScript) —
// lời Larry thành bong bóng, lựa chọn của em thành lượt nói của em. Hỏi xong
// phiếu thì chuyển thẳng sang trò chuyện tự do, không đổi màn hình, không mất đi
// đoạn vừa nói.
//
// Trước đây đoạn mở đầu là một màn hình riêng đứng chắn phía trước: hết màn đó
// rồi nhảy sang khung chat thì mọi thứ em vừa kể biến mất, cuộc trò chuyện bắt
// đầu lại từ con số không — trong khi đó chính là đoạn mở đầu của nó.
//
// Camera sống xuyên suốt (useCompanionCamera): em bật tắt lúc nào cũng được,
// nhưng cảm xúc chỉ được ĐỌC ĐÚNG MỘT LẦN cho cả phiên.
const ProtectedApp = () => {
  const [characterId, setCharacterId] = useState(readSavedCharacterId);
  const camera = useCompanionCamera();

  // checkin = null khi em bỏ qua hết các câu hỏi; lúc đó system prompt giữ
  // nguyên như khi không có phiếu.
  const intro = useIntroScript({ camera });

  // Tri thức agent vừa tra ở lượt gần nhất, do ChatBox đẩy lên. Nó thuộc về bảng
  // bên trái chứ không thuộc khung chat, nên state phải nằm ở đây.
  const [knowledgeView, setKnowledgeView] = useState({
    knowledge: null,
    busy: false,
  });

  const pickCharacter = useCallback((id) => {
    setCharacterId(id);
    saveCharacterId(id);
  }, []);

  return (
    <ProtectedRoute>
      <div className="app-shell">
        <PlayfulBackground />

        <div className="app-layout">
          <section className="panel-left">
            <div className="camera-stack">
              {/* Gương mặt Larry ở lại suốt cuộc trò chuyện, cùng mấy cái nút em
                  bấm được bất cứ lúc nào: đóng/mở mắt, đổi gương mặt, lối ra.
                  Mắt mở đúng vào lúc kịch bản trong khung chat nói tới — tư thế
                  do useIntroScript điều khiển. */}
              <CompanionPanel
                characterId={characterId}
                onPickCharacter={pickCharacter}
                camera={camera}
                pose={intro.pose}
                account={<AccountPill />}
              />

              {/* Bảng cho thấy Larry lấy câu trả lời từ tài liệu nào */}
              <KnowledgePanel
                knowledge={knowledgeView.knowledge}
                busy={knowledgeView.busy}
                cameraOff={!camera.isOn}
              />

              {/* Lời mời góp ý — đặt dưới bảng tri thức, ngoài khung chat, để
                  không chen vào mạch trò chuyện của em */}
              <FeedbackLinks />

              <div className="camera-stack__menu">
                <UserMenu />
              </div>
            </div>
          </section>
          <section className="panel-right">
            <ChatBox
              characterId={characterId}
              emotion={camera.emotion}
              emotionReady={camera.emotionReady}
              checkin={intro.checkin}
              intro={intro}
              onKnowledge={setKnowledgeView}
            />
          </section>
        </div>
      </div>
    </ProtectedRoute>
  );
};

// Cửa /login.
//
// Vừa đăng nhập xong thì đi thẳng vào khu vực của mình — đó là điều ai cũng
// mong đợi khi vừa gõ mật khẩu. Nhưng người ĐÃ đăng nhập từ trước mà tự mở
// /login (bấm "Vào chat" ở trang giới thiệu chẳng hạn) thì KHÔNG bị chuyển
// hướng: họ dừng lại ở màn hình đăng nhập và tự bấm vào chat.
//
// Phân biệt hai trường hợp bằng đúng một câu hỏi: lúc mở trang này ra, đã đăng
// nhập sẵn chưa? Trả lời một lần rồi giữ nguyên (useRef) — nếu đọc lại mỗi lần
// render thì ngay sau khi đăng nhập thành công nó cũng thành "đã đăng nhập sẵn"
// và không ai được vào đâu cả.
const LoginRoute = ({ homePath }) => {
  const { isAuthenticated } = useAuth();
  const signedInOnArrival = useRef(isAuthenticated).current;

  if (isAuthenticated && !signedInOnArrival)
    return <Navigate to={homePath} replace />;

  return <Login />;
};

const AppContent = () => {
  const { user, isAuthenticated, loading } = useAuth();

  const homePath = homePathForRole(user?.role);

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
      {/* Trang giới thiệu CÔNG KHAI, nằm song song với trang đăng nhập: ai mở
          đường link cũng xem được, kể cả khi đang đăng nhập rồi. Cố ý KHÔNG
          chuyển hướng người đã đăng nhập đi chỗ khác — họ vẫn có quyền quay lại
          đọc giới thiệu bất cứ lúc nào. */}
      <Route
        path="/gioi-thieu"
        element={
          <Suspense
            fallback={
              <div className="loading-screen">
                <div className="spinner"></div>
                <p>Đang mở trang giới thiệu...</p>
              </div>
            }
          >
            <AboutPage />
          </Suspense>
        }
      />

      {/* Trang đăng nhập là CỬA VÀO THẬT của khung chat, không phải một trạm
          trung chuyển. Người đã đăng nhập sẵn mở nó lên vẫn thấy màn hình chào
          cùng nút "Trò chuyện với Larry ngay" — bấm rồi mới vào, chứ không bị
          đẩy thẳng vào giữa cuộc trò chuyện. Xem LoginRoute. */}
      <Route path="/login" element={<LoginRoute homePath={homePath} />} />

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
        path="/teacher"
        element={
          <TeacherRoute>
            <TeacherPage />
          </TeacherRoute>
        }
      />
      <Route
        path="/counselor"
        element={
          <CounselorRoute>
            <CounselorPage />
          </CounselorRoute>
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
      {/* Khung chat có địa chỉ RIÊNG. Trước đây nó nằm ngay tại "/", nên người đã
          đăng nhập mở app lên là rơi thẳng vào cuộc trò chuyện, không có đường nào
          quay ra xem lại giới thiệu ngoài việc tự gõ địa chỉ. */}
      <Route path="/chat" element={<ProtectedApp />} />

      {/* Cửa vào của cả web LUÔN là trang giới thiệu, kể cả khi đã đăng nhập: mở
          app lên thì thấy Larry là gì, có gì mới, rồi tự bấm vào chat khi muốn —
          chứ không bị ném thẳng vào giữa cuộc trò chuyện.

          Cố ý chuyển hướng sang /gioi-thieu chứ không vẽ AboutPage ngay tại "/":
          trang giới thiệu chỉ có MỘT địa chỉ, nên gửi link cho nhau không ra hai
          đường dẫn cùng nội dung. */}
      <Route path="/" element={<Navigate to="/gioi-thieu" replace />} />
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
