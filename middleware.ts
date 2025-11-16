import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  // 處理 CORS 預檢請求
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 });

    // 設定 CORS 標頭
    const allowedOrigins = [
      'http://localhost:3004',
      'http://localhost:3000',
      'http://127.0.0.1:3004',
      'http://127.0.0.1:3000'
    ];

    const origin = request.headers.get('origin');

    if (origin && allowedOrigins.includes(origin)) {
      response.headers.set('Access-Control-Allow-Origin', origin);
    }

    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Max-Age', '86400');

    return response;
  }

  // 對於非 OPTIONS 請求，繼續正常處理
  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*'
};