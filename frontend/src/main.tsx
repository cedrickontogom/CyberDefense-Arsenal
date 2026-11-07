import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ConfigProvider, message } from 'antd'
import dayjs from 'dayjs'
import 'dayjs/locale/fr'
import 'antd/dist/reset.css'
import '@ant-design/pro-components/dist/index.css'

import App from './App'
import { AuthProvider } from './store/authStore'
import { ThemeProvider } from './store/themeStore'
import { WebSocketProvider } from './store/wsStore'
import './styles/global.scss'

// Configure dayjs
dayjs.locale('fr')

// Configure message
message.config({
  top: 100,
  duration: 3,
  maxCount: 3,
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
          fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        },
        components: {
          Layout: {
            headerBg: '#fff',
            siderBg: '#001529',
          },
          Menu: {
            itemBg: 'transparent',
            itemSelectedBg: '#1890ff15',
          },
          Card: {
            borderRadius: 8,
          },
          Button: {
            borderRadius: 6,
          },
          Table: {
            borderRadius: 8,
          },
        },
      }}
      locale={{ }}
    >
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <WebSocketProvider>
              <App />
            </WebSocketProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ConfigProvider>
  </React.StrictMode>
)