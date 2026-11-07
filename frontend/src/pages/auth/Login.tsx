import React, { useState } from 'react'
import { Form, Input, Button, Card, Alert, Typography, Checkbox, Spin } from 'antd'
import { LockOutlined, UserOutlined, MailOutlined, SafetyOutlined, EyeOutlined, EyeInvisibleOutlined, LoadingOutlined } from '@ant-design/icons'
import { useAuth } from '../../store/authStore'
import './Login.scss'

const { Title, Text } = Typography
const { TextArea } = Input

const Login: React.FC = () => {
  const { login, isLoading } = useAuth()
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [mfaRequired, setMfaRequired] = useState(false)
  const [mfaCode, setMfaCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [form] = Form.useForm()

  const handleSubmit = async (values: any) => {
    setError(null)
    try {
      if (mfaRequired) {
        await login(values.email, values.password, mfaCode)
      } else {
        await login(values.email, values.password)
      }
    } catch (err: any) {
      if (err.response?.status === 401 && err.response?.data?.error?.message?.includes('MFA')) {
        setMfaRequired(true)
        setError('Code MFA requis')
      } else {
        setError(err.response?.data?.error?.message || 'Erreur de connexion')
      }
    }
  }

  const handleMfaSubmit = async () => {
    setError(null)
    try {
      await login(form.getFieldValue('email'), form.getFieldValue('password'), mfaCode)
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Code MFA invalide')
    }
  }

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <div className="login-logo">
            <SafetyOutlined style={{ fontSize: 48, color: '#1890ff' }} />
          </div>
          <Title level={2}>CyberDefense Arsenal</Title>
          <Text type="secondary">Plateforme unifiée de défense cybersécurité</Text>
        </div>

        <Card className="login-card">
          {!mfaRequired ? (
            <Form form={form} layout="vertical" onFinish={handleSubmit}>
              {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

              <Form.Item
                name="email"
                label="Email"
                rules={[{ required: true, message: 'Email requis' }, { type: 'email', message: 'Email invalide' }]}
              >
                <Input
                  prefix={<MailOutlined />}
                  placeholder="votre@email.com"
                  autoComplete="email"
                />
              </Form.Item>

              <Form.Item
                name="password"
                label="Mot de passe"
                rules={[{ required: true, message: 'Mot de passe requis' }]}
              >
                <Input.Password
                  prefix={<LockOutlined />}
                  placeholder="••••••••"
                  visibilityToggle={{
                    onClick: () => setPasswordVisible(!passwordVisible),
                    visible: passwordVisible,
                  }}
                  autoComplete="current-password"
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  block
                  size="large"
                  loading={isLoading}
                  icon={isLoading ? <LoadingOutlined /> : <LockOutlined />}
                >
                  {isLoading ? 'Connexion...' : 'Se connecter'}
                </Button>
              </Form.Item>
            </Form>
          ) : (
            <div className="mfa-form">
              <Alert message="Authentification à deux facteurs" description="Entrez le code à 6 chiffres de votre application d'authentification" type="info" showIcon style={{ marginBottom: 16 }} />
              {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

              <Form form={form} layout="vertical" onFinish={handleMfaSubmit}>
                <Form.Item
                  name="mfa_code"
                  label="Code MFA"
                  rules={[{ required: true, message: 'Code requis' }, { min: 6, max: 6, message: '6 chiffres' }]}
                >
                  <Input
                    prefix={<SafetyOutlined />}
                    placeholder="123456"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={mfaCode}
                    onChange={e => setMfaCode(e.target.value)}
                  />
                </Form.Item>

                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    block
                    size="large"
                    loading={isLoading}
                    icon={isLoading ? <LoadingOutlined /> : <LockOutlined />}
                  >
                    {isLoading ? 'Vérification...' : 'Vérifier'}
                  </Button>
                </Form.Item>
              </Form>

              <div className="mfa-footer">
                <Button type="link" onClick={() => { setMfaRequired(false); form.resetFields(); }}>
                  Retour
                </Button>
              </div>
            </div>
          )}
        </Card>

        <div className="login-footer">
          <Text type="secondary">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer">Open Source</a> •
            <a href="/docs" target="_blank" rel="noopener noreferrer">Documentation</a> •
            <a href="/security" target="_blank" rel="noopener noreferrer">Sécurité</a>
          </Text>
          <Text type="secondary" style={{ marginTop: 8 }}>
            v1.0.0 - MIT License
          </Text>
        </div>
      </div>

      <div className="login-background">
        <div className="bg-shape shape-1"></div>
        <div className="bg-shape shape-2"></div>
        <div className="bg-shape shape-3"></div>
      </div>
    </div>
  )
}

export default Login