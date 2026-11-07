import React, { useState } from 'react'
import {
  Card, Form, Input, Button, Tabs, TabPane, Typography,
  Avatar, Alert, Switch, Divider, Space, Tag, List,
  Modal, Select, DatePicker, Upload, message, Popconfirm
} from 'antd'
import {
  UserOutlined, LockOutlined, SafetyOutlined, MailOutlined,
  PhoneOutlined, GlobalOutlined, EditOutlined, SaveOutlined,
  DeleteOutlined, PlusOutlined, EyeOutlined, EyeInvisibleOutlined,
  QrcodeOutlined, DownloadOutlined, SettingOutlined
} from '@ant-design/icons'
import { useAuth } from '../store/authStore'
import { api } from '../services/api'
import './Settings.scss'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { Option } = Select

const Settings: React.FC = () => {
  const { user, updateUser, changePassword, setupMFA, verifyMFA, disableMFA } = useAuth()
  const [activeTab, setActiveTab] = useState('profile')
  const [loading, setLoading] = useState(false)
  const [mfaModalVisible, setMfaModalVisible] = useState(false)
  const [mfaSetupData, setMfaSetupData] = useState<any>(null)
  const [mfaCode, setMfaCode] = useState('')
  const [mfaRecoveryCode, setMfaRecoveryCode] = useState('')
  const [passwordVisible, setPasswordVisible] = useState({ old: false, new: false, confirm: false })
  const [sessions, setSessions] = useState<any[]>([])
  const [apiKeys, setApiKeys] = useState<any[]>([])

  const [profileForm] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [preferencesForm] = Form.useForm()

  const handleProfileSubmit = async (values: any) => {
    setLoading(true)
    try {
      await updateUser(values)
      message.success('Profil mis à jour')
      profileForm.setFieldsValue({ ...values })
    } catch (error) {
      message.error('Erreur lors de la mise à jour')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = async (values: any) => {
    setLoading(true)
    try {
      await changePassword(values.old_password, values.new_password)
      message.success('Mot de passe changé')
      passwordForm.resetFields()
    } catch (error: any) {
      message.error(error.response?.data?.error?.message || 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  const handlePreferencesSubmit = async (values: any) => {
    setLoading(true)
    try {
      await updateUser({ preferences: values })
      message.success('Préférences sauvegardées')
    } catch (error) {
      message.error('Erreur')
    } finally {
      setLoading(false)
    }
  }

  const handleSetupMFA = async () => {
    try {
      const data = await setupMFA()
      setMfaSetupData(data)
      setMfaModalVisible(true)
    } catch (error) {
      message.error('Erreur lors de la configuration MFA')
    }
  }

  const handleVerifyMFA = async () => {
    try {
      await verifyMFA(mfaCode, mfaRecoveryCode || undefined)
      message.success('MFA activé avec succès')
      setMfaModalVisible(false)
      setMfaCode('')
      setMfaRecoveryCode('')
    } catch (error) {
      message.error('Code invalide')
    }
  }

  const handleDisableMFA = async () => {
    try {
      await disableMFA(mfaCode, mfaRecoveryCode || undefined)
      message.success('MFA désactivé')
      setMfaModalVisible(false)
    } catch (error) {
      message.error('Code invalide')
    }
  }

  const fetchSessions = async () => {
    try {
      const res = await api.get('/users/sessions/')
      setSessions(res.results || [])
    } catch (error) {
      console.error('Failed to fetch sessions:', error)
    }
  }

  const fetchApiKeys = async () => {
    try {
      const res = await api.get('/users/api-keys/')
      setApiKeys(res.results || [])
    } catch (error) {
      console.error('Failed to fetch API keys:', error)
    }
  }

  const revokeSession = async (sessionId: string) => {
    try {
      await api.delete(`/users/sessions/${sessionId}/`)
      fetchSessions()
    } catch (error) {
      message.error('Erreur')
    }
  }

  const createApiKey = async () => {
    try {
      const res = await api.post('/users/api-keys/', { name: `Key ${new Date().toLocaleString()}`, scopes: ['read', 'write'] })
      message.success('Clé créée - Copiez-la maintenant !')
      navigator.clipboard.writeText(res.full_key)
      fetchApiKeys()
    } catch (error) {
      message.error('Erreur')
    }
  }

  const revokeApiKey = async (keyId: string) => {
    try {
      await api.post(`/users/api-keys/${keyId}/revoke/`)
      fetchApiKeys()
    } catch (error) {
      message.error('Erreur')
    }
  }

  return (
    <div className="settings-page">
      <Title level={2} style={{ marginBottom: 24 }}>Paramètres</Title>

      <Tabs activeKey={activeTab} onChange={setActiveTab} className="settings-tabs">
        <TabPane tab="Profil" key="profile">
          <Card title="Informations du profil" style={{ marginBottom: 16 }}>
            <Form form={profileForm} layout="vertical" onFinish={handleProfileSubmit} initialValues={user}>
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
                    <Input disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="username" label="Nom d'utilisateur" rules={[{ required: true }]}>
                    <Input disabled />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="first_name" label="Prénom">
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="last_name" label="Nom">
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="phone" label="Téléphone">
                    <Input placeholder="+33 6 00 00 00 00" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="timezone" label="Fuseau horaire">
                    <Select>
                      <Option value="UTC">UTC</Option>
                      <Option value="Europe/Paris">Europe/Paris (UTC+1/+2)</Option>
                      <Option value="America/New_York">America/New_York (UTC-5/-4)</Option>
                      <Option value="Asia/Tokyo">Asia/Tokyo (UTC+9)</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item name="language" label="Langue">
                    <Select>
                      <Option value="fr">Français</Option>
                      <Option value="en">English</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
              <Divider />
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
                  Enregistrer
                </Button>
              </Form.Item>
            </Form>
          </Card>

          <Card title="Sécurité du compte">
            <List
              grid={{ gutter: 16, xs: 1, sm: 2, lg: 3 }}
              dataSource={[
                { title: 'MFA', description: user?.mfa_enabled ? 'Activé' : 'Désactivé', action: user?.mfa_enabled ? 'Désactiver' : 'Activer', onAction: user?.mfa_enabled ? () => { setMfaCode(''); setMfaModalVisible(true); } : handleSetupMFA },
                { title: 'Changer le mot de passe', description: 'Mettre à jour votre mot de passe', action: 'Modifier', onAction: () => setActiveTab('password') },
                { title: 'Sessions actives', description: `${sessions.length} session(s)`, action: 'Voir', onAction: () => setActiveTab('sessions') },
                { title: 'Clés API', description: `${apiKeys.length} clé(s)`, action: 'Gérer', onAction: () => setActiveTab('apikeys') },
              ]}
              renderItem={item => (
                <List.Item
                  actions={[
                    <Button type="link" size="small" onClick={item.onAction}>{item.action}</Button>
                  ]}
                >
                  <List.Item.Meta title={item.title} description={item.description} />
                </List.Item>
              )}
            />
          </Card>
        </TabPane>

        <TabPane tab="Mot de passe" key="password">
          <Card title="Changer le mot de passe">
            <Form form={passwordForm} layout="vertical" onFinish={handlePasswordSubmit}>
              <Form.Item name="old_password" label="Mot de passe actuel" rules={[{ required: true }]}>
                <Input.Password
                  type={passwordVisible.old ? 'text' : 'password'}
                  suffix={<EyeOutlined onClick={() => setPasswordVisible(p => ({ ...p, old: !p.old }))} />}
                />
              </Form.Item>
              <Form.Item name="new_password" label="Nouveau mot de passe" rules={[{ required: true, min: 8 }]}>
                <Input.Password
                  type={passwordVisible.new ? 'text' : 'password'}
                  suffix={<EyeOutlined onClick={() => setPasswordVisible(p => ({ ...p, new: !p.new }))} />}
                />
              </Form.Item>
              <Form.Item name="new_password_confirm" label="Confirmer" rules={[{ required: true }, ({ getFieldValue }) => ({ validator: (_, value) => value === getFieldValue('new_password') ? Promise.resolve() : Promise.reject('Les mots de passe ne correspondent pas') })]}>
                <Input.Password
                  type={passwordVisible.confirm ? 'text' : 'password'}
                  suffix={<EyeOutlined onClick={() => setPasswordVisible(p => ({ ...p, confirm: !p.confirm }))} />}
                />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} icon={<LockOutlined />}>
                  Changer le mot de passe
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane tab="MFA" key="mfa">
          <Card title="Authentification à deux facteurs (MFA)">
            {user?.mfa_enabled ? (
              <div className="mfa-enabled">
                <Alert message="MFA activé" description="Votre compte est protégé par l'authentification à deux facteurs." type="success" showIcon />
                <Space direction="vertical" style={{ width: '100%', marginTop: 16 }}>
                  <Button danger onClick={() => { setMfaCode(''); setMfaRecoveryCode(''); setMfaModalVisible(true); }}>
                    <LockOutlined /> Désactiver MFA
                  </Button>
                  <Button onClick={() => { setMfaCode(''); setMfaRecoveryCode(''); setMfaModalVisible(true); }}>
                    <QrcodeOutlined /> Régénérer codes de récupération
                  </Button>
                </Space>
              </div>
            ) : (
              <div className="mfa-disabled">
                <Alert message="MFA désactivé" description="Activez l'authentification à deux facteurs pour sécuriser votre compte." type="warning" showIcon />
                <Button type="primary" icon={<SafetyOutlined />} onClick={handleSetupMFA} style={{ marginTop: 16 }}>
                  Activer MFA
                </Button>
              </div>
            )}

            {/* MFA Modal */}
            <Modal
              title={user?.mfa_enabled ? 'Désactiver MFA' : 'Configurer MFA'}
              open={mfaModalVisible}
              onCancel={() => setMfaModalVisible(false)}
              onOk={user?.mfa_enabled ? handleDisableMFA : handleVerifyMFA}
              width={500}
              destroyOnClose
            >
              {user?.mfa_enabled ? (
                <Form layout="vertical">
                  <Alert message="Entrez un code MFA ou un code de récupération pour désactiver." type="info" showIcon />
                  <Form.Item name="code" label="Code MFA (6 chiffres)">
                    <Input placeholder="123456" value={mfaCode} onChange={e => setMfaCode(e.target.value)} />
                  </Form.Item>
                  <Form.Item name="recovery_code" label="Ou code de récupération">
                    <Input placeholder="ABCD1234" value={mfaRecoveryCode} onChange={e => setMfaRecoveryCode(e.target.value)} />
                  </Form.Item>
                </Form>
              ) : mfaSetupData ? (
                <div className="mfa-setup">
                  <Alert message="Scannez ce QR code avec votre application d'authentification (Google Authenticator, Authy, etc.)" type="info" showIcon />
                  <div className="qr-code" style={{ textAlign: 'center', margin: '16px 0' }}>
                    <img src={mfaSetupData.qr_code} alt="MFA QR Code" style={{ maxWidth: '200px' }} />
                  </div>
                  <div className="recovery-codes">
                    <strong>Codes de récupération (conservez-les précieusement) :</strong>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginTop: '8px' }}>
                      {mfaSetupData.recovery_codes.map((code: string, i: number) => (
                        <Tag key={i} color="blue">{code}</Tag>
                      ))}
                    </div>
                    <Button type="link" onClick={() => navigator.clipboard.writeText(mfaSetupData.recovery_codes.join('\n'))} icon={<DownloadOutlined />}>
                      Télécharger les codes
                    </Button>
                  </div>
                  <Divider />
                  <Form layout="vertical">
                    <Form.Item name="code" label="Code MFA pour valider" rules={[{ required: true }]}>
                      <Input placeholder="123456" value={mfaCode} onChange={e => setMfaCode(e.target.value)} />
                    </Form.Item>
                    <Form.Item name="recovery_code" label="Ou code de récupération">
                      <Input placeholder="ABCD1234" value={mfaRecoveryCode} onChange={e => setMfaRecoveryCode(e.target.value)} />
                    </Form.Item>
                  </Form>
                </div>
              ) : null}
            </Modal>
          </Card>
        </TabPane>

        <TabPane tab="Sessions" key="sessions">
          <Card title="Sessions actives">
            <List
              dataSource={sessions}
              renderItem={session => (
                <List.Item
                  actions={session.is_current ? [] : [
                    <Popconfirm title="Révoquer cette session ?" onConfirm={() => revokeSession(session.id)} okText="Oui" cancelText="Non">
                      <Button type="link" size="small" danger>Révoquer</Button>
                    </Popconfirm>
                  ]}
                >
                  <List.Item.Meta
                    title={session.is_current ? <span>Session actuelle <Tag color="blue">Actuelle</Tag></span> : session.ip_address}
                    description={<Space>
                      <Text>{session.user_agent}</Text>
                      <Text type="secondary">{session.location}</Text>
                      <Text type="secondary">Dernière activité: {new Date(session.last_activity).toLocaleString('fr-FR')}</Text>
                    </Space>}
                  />
                </List.Item>
              )}
            />
            <Divider />
            <Button onClick={fetchSessions} icon={<SyncOutlined />}>Actualiser</Button>
            <Button danger onClick={() => { /* revoke all */ }} style={{ marginLeft: 8 }}>
              Révoquer toutes les autres sessions
            </Button>
          </Card>
        </TabPane>

        <TabPane tab="Clés API" key="apikeys">
          <Card title="Clés API">
            <Space style={{ marginBottom: 16 }}>
              <Button type="primary" icon={<PlusOutlined />} onClick={createApiKey}>
                Nouvelle clé API
              </Button>
            </Space>
            <List
              dataSource={apiKeys}
              renderItem={key => (
                <List.Item
                  actions={[
                    <Button type="link" size="small" onClick={() => navigator.clipboard.writeText(key.full_key || '')} disabled={!key.full_key}>
                      <CopyOutlined /> Copier
                    </Button>,
                    <Popconfirm title="Révoquer cette clé ?" onConfirm={() => revokeApiKey(key.id)} okText="Oui" cancelText="Non">
                      <Button type="link" size="small" danger>Révoquer</Button>
                    </Popconfirm>
                  ]}
                >
                  <List.Item.Meta
                    title={<Space>
                      <Tag color={key.is_active ? 'green' : 'gray'}>{key.is_active ? 'Active' : 'Révoquée'}</Tag>
                      <strong>{key.name}</strong>
                      <Tag color="blue">{key.key_prefix}...</Tag>
                    </Space>}
                    description={<Space direction="vertical" style={{ width: '100%' }}>
                      <Text>Scopes: {key.scopes.join(', ')}</Text>
                      <Text type="secondary">Créée le: {new Date(key.created_at).toLocaleString('fr-FR')}</Text>
                      {key.last_used_at && <Text type="secondary">Dernière utilisation: {new Date(key.last_used_at).toLocaleString('fr-FR')}</Text>}
                      {key.expires_at && <Text type="secondary">Expire le: {new Date(key.expires_at).toLocaleString('fr-FR')}</Text>}
                    </Space>}
                  />
                </List.Item>
              )}
            />
          </Card>
        </TabPane>

        <TabPane tab="Préférences" key="preferences">
          <Card title="Préférences d'interface">
            <Form form={preferencesForm} layout="vertical" onFinish={handlePreferencesSubmit} initialValues={user?.preferences}>
              <Form.Item name="theme" label="Thème" rules={[{ required: true }]}>
                <Select>
                  <Option value="auto">Auto (système)</Option>
                  <Option value="light">Clair</Option>
                  <Option value="dark">Sombre</Option>
                </Select>
              </Form.Item>
              <Form.Item name="notifications" label="Notifications" valuePropName="checked">
                <Switch checkedChildren="Activées" unCheckedChildren="Désactivées" />
              </Form.Item>
              <Form.Item name="email_alerts" label="Alertes par email" valuePropName="checked">
                <Switch checkedChildren="Activées" unCheckedChildren="Désactivées" />
              </Form.Item>
              <Form.Item name="compact_mode" label="Mode compact" valuePropName="checked">
                <Switch checkedChildren="Activé" unCheckedChildren="Désactivé" />
              </Form.Item>
              <Form.Item name="auto_refresh" label="Actualisation auto" valuePropName="checked">
                <Switch checkedChildren="Activée" unCheckedChildren="Désactivée" />
              </Form.Item>
              <Form.Item name="refresh_interval" label="Intervalle (secondes)">
                <Input.Number min={30} max={3600} style={{ width: 100 }} />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />}>
                  Sauvegarder
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  )
}

export default Settings