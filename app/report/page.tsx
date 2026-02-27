"use client";

// [로직 해석] 리액트의 상태 관리 훅과 라우팅 이동을 위한 useRouter를 불러옵니다.
import { useState } from "react";
import { useRouter } from "next/navigation";

// [로직 해석] 유저가 팝업을 제보하는 전체 페이지 컴포넌트입니다.
export default function ReportPage() {
  // [로직 해석] 페이지 이동을 제어할 router 객체를 초기화합니다.
  const router = useRouter();

  // [로직 해석] 폼에 입력될 데이터들을 하나의 객체 상태(State)로 관리합니다.
  const [formData, setFormData] = useState({
    name: "",         // 팝업스토어 이름
    category: "FASHION", // 카테고리 (기본값 설정)
    location: "",     // 간단한 지역명 (예: 성수동)
    address: "",      // 상세 주소
    startDate: "",    // 시작 날짜
    endDate: "",      // 종료 날짜
    description: "",  // 간단한 설명
    reporterId: "test_user", // 🔥 실제 배포 시에는 로그인한 유저의 ID로 교체해야 합니다!
  });

  // [로직 해석] 사용자가 입력 칸(input)에 값을 타이핑할 때마다 상태를 업데이트하는 함수입니다.
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    // [로직 해석] 이벤트 객체에서 name(필드명)과 value(입력값)를 추출합니다.
    const { name, value } = e.target;
    // [로직 해석] 기존 데이터를 복사(...prev)한 뒤, 현재 수정 중인 필드만 새 값으로 덮어씁니다.
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // [로직 해석] [제보하기] 버튼을 눌렀을 때 실행되는 제출 함수입니다.
  const handleSubmit = async (e: React.FormEvent) => {
    // [로직 해석] 폼 제출 시 페이지가 새로고침되는 기본 브라우저 동작을 막습니다.
    e.preventDefault();

    try {
     const response = await fetch("http://34.121.40.248:8080/api/popups/report", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(formData),
});

      // [로직 해석] 백엔드에서 정상적으로 처리(200 OK)되었다면 성공 알림을 띄웁니다.
      if (response.ok) {
        alert("팝업스토어 제보가 완료되었습니다! 관리자 승인 후 지도에 노출됩니다.");
        // [로직 해석] 제보가 끝났으므로 유저를 다시 메인 페이지('/')로 돌려보냅니다.
        router.push("/");
      } else {
        // [로직 해석] 에러 발생 시 알림을 띄웁니다.
        alert("제보 처리 중 오류가 발생했습니다.");
      }
    } catch (error) {
      // [로직 해석] 서버가 꺼져있거나 네트워크 통신 자체가 실패했을 때의 예외 처리입니다.
      console.error("제보 실패:", error);
      alert("서버와 연결할 수 없습니다.");
    }
  };

  // [로직 해석] 화면에 렌더링될 HTML 구조입니다. Tailwind CSS로 반응형과 여백을 조절했습니다.
  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-12">
      <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-lg p-8">
        
        {/* [로직 해석] 페이지 상단 제목 영역입니다. */}
        <h1 className="text-3xl font-black text-gray-900 mb-2">팝업스토어 제보하기 📢</h1>
        <p className="text-gray-500 mb-8">알고 있는 팝업스토어 정보를 공유하고 확성기 보상을 받아보세요!</p>

        {/* [로직 해석] 데이터를 입력받을 폼 태그입니다. onSubmit 이벤트에 위에서 만든 함수를 연결합니다. */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* [로직 해석] 팝업스토어 이름 입력 영역 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">팝업스토어 이름 *</label>
            <input 
              type="text" name="name" required
              value={formData.name} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="예) 휩드 하우스 성수"
            />
          </div>

          {/* [로직 해석] 카테고리 선택(Select) 영역 */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">카테고리 *</label>
            <select 
              name="category" 
              value={formData.category} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="FASHION">패션 (FASHION)</option>
              <option value="FOOD">음식/카페 (FOOD)</option>
              <option value="POPUP">일반 팝업 (POPUP)</option>
            </select>
          </div>

          {/* [로직 해석] 모바일 화면을 위해 지역과 날짜를 2단 그리드(grid-cols-2)로 배치합니다. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">지역 (간략히) *</label>
              <input 
                type="text" name="location" required
                value={formData.location} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-3 outline-none"
                placeholder="예) 성수동, 여의도"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">상세 주소</label>
              <input 
                type="text" name="address" 
                value={formData.address} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-3 outline-none"
                placeholder="상세한 도로명 주소"
              />
            </div>
          </div>

          {/* [로직 해석] 시작 날짜와 종료 날짜를 입력받는 영역입니다. */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">시작일 *</label>
              <input 
                type="date" name="startDate" required
                value={formData.startDate} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-3 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">종료일 *</label>
              <input 
                type="date" name="endDate" required
                value={formData.endDate} onChange={handleChange}
                className="w-full border border-gray-300 rounded-lg p-3 outline-none"
              />
            </div>
          </div>

          {/* [로직 해석] 팝업스토어에 대한 긴 설명을 입력받는 텍스트 에어리어입니다. */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">간단한 설명</label>
            <textarea 
              name="description" rows={4}
              value={formData.description} onChange={handleChange}
              className="w-full border border-gray-300 rounded-lg p-3 outline-none resize-none"
              placeholder="팝업스토어의 특징이나 즐길 거리를 적어주세요!"
            ></textarea>
          </div>

          {/* [로직 해석] 폼을 제출하는 최종 버튼입니다. */}
          <button 
            type="submit" 
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg transition-all active:scale-95"
          >
            제보 제출하기
          </button>
        </form>

      </div>
    </div>
  );
}