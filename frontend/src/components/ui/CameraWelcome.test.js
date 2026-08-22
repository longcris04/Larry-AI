import { fireEvent, render, screen } from "@testing-library/react";
import CameraWelcome from "./CameraWelcome";

test("xin phép camera rõ ràng và vẫn cho tiếp tục khi từ chối", () => {
  const onAllow = jest.fn();
  const onDecline = jest.fn();
  render(<CameraWelcome onAllow={onAllow} onDecline={onDecline} />);

  expect(screen.getByRole("heading", { name: /Chào bạn! Mình là Larry/ })).toBeInTheDocument();
  expect(screen.getByText(/không được lưu hoặc gửi đi/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /Đồng ý mở camera/ }));
  fireEvent.click(screen.getByRole("button", { name: /Không cần camera/ }));

  expect(onAllow).toHaveBeenCalledTimes(1);
  expect(onDecline).toHaveBeenCalledTimes(1);
});
