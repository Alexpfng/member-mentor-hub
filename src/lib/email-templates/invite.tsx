import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from '@react-email/components'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
  coachName?: string
}

export const InviteEmail = ({
  siteName,
  confirmationUrl,
  coachName,
}: InviteEmailProps) => (
  <Html lang="fr" dir="ltr">
    <Head />
    <Preview>Ton coach t'invite à rejoindre {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Tu as été invité(e) 🎯</Heading>
        <Text style={text}>
          {coachName ? `${coachName} t'` : "Ton coach t'"}invite à rejoindre{' '}
          <strong>{siteName}</strong>, l'application de suivi d'entraînement personnalisé.
        </Text>
        <Text style={text}>
          Clique sur le bouton ci-dessous pour créer ton compte et accéder à ton programme.
          Ce lien est valable <strong>14 jours</strong> et utilisable une seule fois.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Rejoindre ColoSmart Training →
        </Button>
        <Text style={footer}>
          Si tu ne t'attendais pas à cette invitation, tu peux ignorer cet email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail

const main = { backgroundColor: '#0e1f12', fontFamily: 'Arial, sans-serif' }
const container = { padding: '32px 28px', maxWidth: '520px', margin: '0 auto', backgroundColor: '#142518', borderRadius: '12px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#ffffff',
  margin: '0 0 16px',
}
const text = {
  fontSize: '14px',
  color: '#b0c4b4',
  lineHeight: '1.6',
  margin: '0 0 18px',
}
const button = {
  backgroundColor: '#2D5A35',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '14px 24px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#666', margin: '28px 0 0' }
