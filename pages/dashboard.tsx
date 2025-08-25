// pages/dashboard.tsx

import Head from 'next/head';
import { useState, useEffect } from 'react';

// 我們先把假數據的「類型」定義出來，這樣 TypeScript 才會知道資料長什麼樣子
interface Artist {
  name: string;
  imageUrl: string;
}

interface ResultData {
  role: {
    name: string;
    catchphrase: string;
  };
  evidence: {
    topArtists: Artist[];
    reasons: string[];
  };
}

export default function DashboardPage() {
  // 1. 建立三個「狀態」來分別存放：我們的資料、是否正在載入、是否發生錯誤
  const [result, setResult] = useState<ResultData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 2. 使用 useEffect 這個 Hook，讓頁面在載入時「只執行一次」以下的程式碼
  useEffect(() => {
    // 定義一個非同步函式來抓取資料
    const fetchData = async () => {
      try {
        // 這就是前端去敲後端 API 的門！
        const response = await fetch('/api/users/me');
        
        if (!response.ok) {
          throw new Error('無法從伺服器獲取資料');
        }
        
        const data: ResultData = await response.json();
        setResult(data); // 成功拿到資料，存到 result 狀態裡

      } catch (err: any) {
        setError(err.message); // 發生錯誤，把錯誤訊息存到 error 狀態裡
      } finally {
        setIsLoading(false); // 無論成功或失敗，都結束載入狀態
      }
    };

    fetchData(); // 執行這個函式
  }, []); // 空陣列 [] 確保這個 effect 只在元件首次載入時執行一次

  // 3. 根據不同的狀態，顯示不同的畫面
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">分析你的聆聽宇宙中...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-red-500">錯誤：{error}</div>;
  }

  if (!result) {
    return <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">找不到你的側寫資料。</div>;
  }
  
  // 4. 成功拿到資料後，才顯示我們設計好的畫面
  return (
    <>
      <Head>
        <title>我的聆聽側寫：{result.role.name}</title>
      </Head>
      <main className="flex items-center justify-center min-h-screen bg-gray-900 text-white font-sans">
        <div className="bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full">
          <div className="text-center mb-6">
            <h1 className="text-4xl font-bold text-teal-400">{result.role.name}</h1>
            <p className="text-lg italic mt-2 text-gray-400">"{result.role.catchphrase}"</p>
          </div>
          <div className="mb-6">
            <h2 className="text-2xl font-semibold mb-4 border-b-2 border-teal-500 pb-2">分析依據</h2>
            <ul className="space-y-4">
              {result.evidence.reasons.map((reason, index) => (
                <li key={index} className="bg-gray-700 p-3 rounded">{reason}</li>
              ))}
              <li className="bg-gray-700 p-3 rounded">
                <p>核心藝人：</p>
                <div className="flex space-x-2 mt-2">
                  {result.evidence.topArtists.map(artist => (
                    <img key={artist.name} src={artist.imageUrl} alt={artist.name} title={artist.name} className="w-12 h-12 rounded-full"/>
                  ))}
                </div>
              </li>
            </ul>
          </div>
          <div className="text-center">
            <button className="bg-teal-500 hover:bg-teal-600 text-white font-bold py-3 px-6 rounded-lg text-xl transition-transform transform hover:scale-105">
              分享我的側寫
            </button>
            <p className="text-xs text-gray-500 mt-4">
              敬請期待 LCP 點數系統與藝人專屬任務！
            </p>
          </div>
        </div>
      </main>
    </>
  );
}