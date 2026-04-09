import * as React from 'react';

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface WeeklyPipelineDigestEmailProps {
  agingDealsCount: number;
  currency: string;
  dealsMovedLastWeek: number;
  generatedAt: string;
  organizationName: string;
  pipelineValue: number;
  tasksDueThisWeek: number;
}

function formatCurrency(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('id-ID', {
      currency,
      maximumFractionDigits: 0,
      style: 'currency',
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString('id-ID')}`;
  }
}

export default function WeeklyPipelineDigestEmail({
  agingDealsCount,
  currency,
  dealsMovedLastWeek,
  generatedAt,
  organizationName,
  pipelineValue,
  tasksDueThisWeek,
}: WeeklyPipelineDigestEmailProps) {
  const previewText = `Weekly pipeline digest for ${organizationName}`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={title}>Weekly Pipeline Digest</Heading>
          <Text style={subtitle}>{organizationName}</Text>
          <Text style={meta}>Generated: {generatedAt}</Text>

          <Section style={card}>
            <Text style={label}>Pipeline Total</Text>
            <Text style={value}>{formatCurrency(pipelineValue, currency)}</Text>
          </Section>

          <Section style={grid}>
            <Section style={metricCard}>
              <Text style={metricLabel}>Deals moved last week</Text>
              <Text style={metricValue}>{dealsMovedLastWeek}</Text>
            </Section>
            <Section style={metricCard}>
              <Text style={metricLabel}>Aging deals</Text>
              <Text style={metricValue}>{agingDealsCount}</Text>
            </Section>
            <Section style={metricCard}>
              <Text style={metricLabel}>Tasks due this week</Text>
              <Text style={metricValue}>{tasksDueThisWeek}</Text>
            </Section>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
  margin: '0',
  padding: '24px 0',
};

const container = {
  backgroundColor: '#ffffff',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  margin: '0 auto',
  maxWidth: '560px',
  padding: '24px',
};

const title = {
  color: '#0f172a',
  fontSize: '24px',
  margin: '0 0 4px',
};

const subtitle = {
  color: '#334155',
  fontSize: '16px',
  margin: '0 0 6px',
};

const meta = {
  color: '#64748b',
  fontSize: '12px',
  margin: '0 0 18px',
};

const card = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  marginBottom: '16px',
  padding: '16px',
};

const label = {
  color: '#64748b',
  fontSize: '12px',
  margin: '0 0 4px',
};

const value = {
  color: '#0f172a',
  fontSize: '28px',
  fontWeight: '700',
  margin: '0',
};

const grid = {
  marginTop: '4px',
};

const metricCard = {
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  marginBottom: '8px',
  padding: '12px',
};

const metricLabel = {
  color: '#64748b',
  fontSize: '12px',
  margin: '0 0 4px',
};

const metricValue = {
  color: '#0f172a',
  fontSize: '18px',
  fontWeight: '700',
  margin: '0',
};
