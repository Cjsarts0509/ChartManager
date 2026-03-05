import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary
 * - 렌더링 중 에러 발생 시 전체 화면 크래시(흰 화면) 대신 복구 UI를 표시
 * - 브라우저 확장/번역 등에 의한 DOM 조작 에러(removeChild 등)도 여기서 잡힘
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] 렌더링 에러 캐치:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const isDomError = this.state.error?.message?.includes('removeChild')
        || this.state.error?.message?.includes('insertBefore')
        || this.state.error?.message?.includes('NotFoundError');

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 p-6">
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-6 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">⚠</span>
            </div>
            <h2 className="text-gray-900 mb-2" style={{ fontSize: '16px', fontWeight: 700 }}>
              화면 표시 오류
            </h2>
            <p className="text-gray-500 mb-1" style={{ fontSize: '13px' }}>
              {isDomError
                ? '브라우저 확장 프로그램(번역, 광고차단 등)이 화면과 충돌했습니다.'
                : '예상치 못한 오류가 발생했습니다.'}
            </p>
            {isDomError && (
              <p className="text-gray-400 mb-4" style={{ fontSize: '11px' }}>
                확장 프로그램을 비활성화하거나 시크릿 모드를 사용하면 방지할 수 있습니다.
              </p>
            )}
            <div className="flex gap-2 justify-center mt-4">
              <button
                onClick={this.handleRetry}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg transition-colors hover:bg-emerald-700 active:bg-emerald-800"
                style={{ fontSize: '13px', fontWeight: 600 }}
              >
                다시 시도
              </button>
              <button
                onClick={this.handleReload}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg transition-colors hover:bg-gray-300 active:bg-gray-400"
                style={{ fontSize: '13px', fontWeight: 600 }}
              >
                새로고침
              </button>
            </div>
            {this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-gray-400 cursor-pointer" style={{ fontSize: '11px' }}>
                  기술 정보
                </summary>
                <pre className="mt-1 p-2 bg-gray-50 rounded text-gray-500 overflow-auto max-h-24" style={{ fontSize: '10px' }}>
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
