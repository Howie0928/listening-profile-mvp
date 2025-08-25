import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Link from 'next/link'; // 引入 Link 元件

export default function Home() {
  const router = useRouter();
  const [status, setStatus] = useState('');
  const [userName, setUserName] = useState('');

  useEffect(() => {
    if (router.query.success === 'true' && router.query.displayName) {
      // 瀏覽器會自動解碼 URL 中的中文字元
      setStatus('授權成功！');
      setUserName(`歡迎你，${router.query.displayName}！`);
    } else if (router.query.error) {
      setStatus(`授權失敗：${router.query.error}`);
    }
  }, [router.query]);

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif', textAlign: 'center' }}>
      <main>
        <h1>
          聆聽側寫 MVP - Spotify 授權測試
        </h1>

        <p>
          點擊下方連結，開始進行 Spotify 授權。
        </p>
        
        {/* --- 這就是修正後的部分 --- */}
        <Link 
          href="/api/auth/spotify/login" 
          style={{ 
            display: 'inline-block', 
            padding: '1rem 2rem', 
            margin: '1rem', 
            border: '1px solid #ccc', 
            borderRadius: '8px',
            textDecoration: 'none',
            color: 'blue'
          }}
        >
          {/* 裡面不再需要 <a> 標籤 */}
          <h2>使用 Spotify 登入 &rarr;</h2>
        </Link>
        
        {status && (
          <div style={{ marginTop: '2rem', padding: '1rem', border: '1px solid grey', borderRadius: '8px', background: '#f9f9f9' }}>
            <h3>測試結果：</h3>
            <p><strong>{userName}</strong></p>
            <p><strong>{status}</strong></p>
            <p>請檢查執行 `npm run dev` 的終端機，確認是否有印出你的完整個人資料。</p>
          </div>
        )}
      </main>
    </div>
  );
}