import { CopilotKit } from "@copilotkit/react-core";
import HomePage from "./components/HomePage";

function App() {
  // 动态获取后端 URL，优先级：环境变量 > 自动检测 > 默认值
  const getBackendUrl = () => {
    // 1. 优先使用环境变量
    if (import.meta.env.VITE_BACKEND_URL) {
      return import.meta.env.VITE_BACKEND_URL;
    }
    
    // 2. 根据当前前端端口自动推断后端端口
    const currentPort = window.location.port;
    const currentProtocol = window.location.protocol;
    const currentHostname = window.location.hostname;
    
    // 如果前端在 3000，后端在 3001
    // 如果前端在 3002，后端在 3001
    // 如果前端在 5173 (Vite默认)，后端在 3001
    const backendPort = '3001'; // 后端固定使用 3001
    
    return `${currentProtocol}//${currentHostname}:${backendPort}`;
  };

  const backendUrl = getBackendUrl();
  
  console.log('🔗 Frontend URL:', window.location.origin);
  console.log('🔗 Backend URL:', backendUrl);

  return (
    <CopilotKit 
      runtimeUrl={`${backendUrl}/api/copilotkit`}
      publicApiKey=""
      showDevConsole={true}
      // 🔧 强制流超时设置
      headers={{
        'x-copilotkit-stream-timeout': '30000' // 30秒超时
      }}
    >
      <HomePage />
    </CopilotKit>
  );
}

export default App; 