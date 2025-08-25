// lib/analysis.ts

// 首先，我們定義好所有角色和他們的「關鍵字」
// 這讓演算法知道該為誰加分
const ROLES = {
    ROCK_FUGITIVE: { name: '搖滾通緝犯', keywords: ['rock', 'metal', 'punk', 'alternative'] },
    FOLK_MIGRATORY_BIRD: { name: '民謠候鳥', keywords: ['folk', 'singer-songwriter', 'acoustic'] },
    KPOP_TRAINEE: { name: 'K-pop練習生', keywords: ['k-pop', 'korean'] },
    RAP_GOOD_CITIZEN: { name: '饒舌好公民', keywords: ['hip hop', 'rap', 'trap'] },
    RNB_DRAKE: { name: 'R&B黑隆', keywords: ['r&b', 'soul'] },
    EDM_PRIMITIVE: { name: 'EDM 原始人', keywords: ['edm', 'house', 'techno', 'dance', 'electronic'] },
    KARAOKE_PRESIDENT: { name: 'K歌大總統', keywords: ['mandopop', 'c-pop', 'cantopop', 'karaoke'] },
    SUZUKI_GUNDAM: { name: '鈴木鋼彈', keywords: ['city pop', 'j-pop', 'japanese', 'anime'] },
  };
  
  // 定義好我們最終要回傳的資料長什麼樣子
  export interface AnalysisResult {
    role: {
      code: string;
      name: string;
      catchphrase: string; // 我們暫時先回傳一個固定的
    };
    evidence: {
      topArtists: { name: string; imageUrl: string; }[];
      reasons: string[];
    };
  }
  
  // 這就是我們演算法的主體！
  export async function analyzeListeningProfile(accessToken: string): Promise<AnalysisResult> {
    // --- 步驟一：數據抓取 ---
    // 我們先去跟 Spotify API 要使用者最常聽的 20 位藝人
    const response = await fetch('https://api.spotify.com/v1/me/top/artists?time_range=medium_term&limit=20', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  
    if (!response.ok) {
      throw new Error('無法從 Spotify 獲取 Top Artists 數據');
    }
    
    const data = await response.json();
    const topArtists = data.items;
  
    // --- 步驟二：特徵提取 (曲風計算) ---
    const genreCounts: { [key: string]: number } = {};
    
    topArtists.forEach((artist: any) => {
      artist.genres.forEach((genre: string) => {
        // 我們把 genre 裡面包含的關鍵字拆出來計算
        const genreWords = genre.split(' ');
        genreWords.forEach(word => {
          genreCounts[word] = (genreCounts[word] || 0) + 1;
        });
      });
    });
  
    // --- 步驟三：計分與決策 ---
    const roleScores: { [key: string]: number } = {};
    Object.keys(ROLES).forEach(roleCode => roleScores[roleCode] = 0);
  
    // 遍歷我們計算出的所有曲風，為對應的角色加分
    for (const genre in genreCounts) {
      for (const roleCode in ROLES) {
        // @ts-ignore
        if (ROLES[roleCode].keywords.includes(genre)) {
          roleScores[roleCode] += genreCounts[genre];
        }
      }
    }
    
    // 找出得分最高的角色
    let winnerRoleCode = 'FOLK_MIGRATORY_BIRD'; // 預設角色
    let maxScore = 0;
    for (const roleCode in roleScores) {
      if (roleScores[roleCode] > maxScore) {
        maxScore = roleScores[roleCode];
        winnerRoleCode = roleCode;
      }
    }
  
    // --- 步驟四：證據生成 ---
    const winnerRoleInfo = ROLES[winnerRoleCode as keyof typeof ROLES];
    
    // 整理要回傳給前端的資料
    const result: AnalysisResult = {
      role: {
        code: winnerRoleCode,
        name: winnerRoleInfo.name,
        catchphrase: '規則？我的效果器上沒有那個旋鈕。', // 暫時寫死
      },
      evidence: {
        topArtists: topArtists.slice(0, 3).map((a: any) => ({ name: a.name, imageUrl: a.images[0]?.url })),
        reasons: [
          `你的聆聽基因圖譜顯示，你對 ${winnerRoleInfo.keywords[0]} 類型的音樂有著強烈的共鳴。`,
          `你最親密的音樂夥伴包括 ${topArtists[0].name}、${topArtists[1].name} 等藝人。`
        ],
      },
    };
    
    return result;
  }