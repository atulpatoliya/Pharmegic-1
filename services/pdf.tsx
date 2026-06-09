import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, renderToBuffer } from '@react-pdf/renderer';

// Define PDF Styles matching the portal's compliance layout
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    color: '#1e293b',
    fontFamily: 'Helvetica',
  },
  border: {
    border: '3 solid #064e3b',
    padding: 20,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  header: {
    textAlign: 'center',
    marginBottom: 20,
    borderBottom: '2 solid #064e3b',
    paddingBottom: 15,
  },
  logoPlaceholder: {
    height: 50,
    width: 150,
    alignSelf: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#064e3b',
    letterSpacing: 1.5,
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 10,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  certNumberContainer: {
    textAlign: 'right',
    marginBottom: 25,
  },
  certNumberLabel: {
    fontSize: 8,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  certNumber: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  body: {
    flexGrow: 1,
    lineHeight: 1.6,
  },
  statement: {
    fontSize: 12,
    marginBottom: 25,
    textAlign: 'justify',
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#f8fafc',
    border: '1 solid #e2e8f0',
    borderRadius: 6,
    padding: 15,
    marginBottom: 25,
  },
  gridRow: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottom: '1 solid #f1f5f9',
  },
  gridLabel: {
    fontWeight: 'bold',
    color: '#475569',
    width: '40%',
  },
  gridValue: {
    color: '#0f172a',
    width: '60%',
  },
  signatureSection: {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    borderTop: '1 solid #e2e8f0',
    paddingTop: 20,
    marginTop: 20,
  },
  qrCode: {
    width: 80,
    height: 80,
  },
  signatureBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    width: 150,
  },
  signatureImage: {
    height: 45,
    width: 120,
    marginBottom: 5,
  },
  signatureLine: {
    borderTop: '1 solid #94a3b8',
    width: '100%',
    marginBottom: 4,
  },
  signatoryTitle: {
    fontSize: 8,
    color: '#64748b',
    textTransform: 'uppercase',
  },
  footer: {
    textAlign: 'center',
    fontSize: 7,
    color: '#94a3b8',
    marginTop: 20,
  },
});

interface CertificateData {
  certificateNumber: string;
  companyName: string;
  legalName: string;
  chemicalName: string;
  casNumber: string;
  ecNumber: string;
  tonnageBand: string;
  quantityMt: number;
  issueDate: string;
  expiryDate: string;
  logoUrl?: string | null;
  signatureUrl?: string | null;
  footerText?: string | null;
  accentColor?: string;
}

const rcStyles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 40,
    paddingHorizontal: 42,
    fontSize: 9.5,
    color: '#1a1a1a',
    fontFamily: 'Helvetica',
    lineHeight: 1.45,
  },
  outerFrame: {
    border: '1.5 solid #064e3b',
    padding: 28,
    minHeight: '92%',
    display: 'flex',
    flexDirection: 'column',
  },
  letterhead: {
    alignItems: 'center',
    marginBottom: 18,
    paddingBottom: 14,
    borderBottom: '1 solid #cbd5e1',
  },
  logo: {
    height: 42,
    width: 160,
    marginBottom: 8,
    alignSelf: 'center',
  },
  orgName: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#064e3b',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  mainTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#064e3b',
    textAlign: 'center',
    marginTop: 14,
    marginBottom: 4,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  templateRef: {
    fontSize: 8,
    color: '#64748b',
    textAlign: 'center',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
    paddingBottom: 10,
    borderBottom: '0.5 solid #e2e8f0',
  },
  metaBlock: {
    width: '48%',
  },
  metaLabel: {
    fontSize: 7.5,
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 9.5,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  sectionHeading: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#064e3b',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 12,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: '0.5 solid #064e3b',
  },
  salutation: {
    fontSize: 9.5,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#0f172a',
  },
  paragraph: {
    fontSize: 9.5,
    textAlign: 'justify',
    marginBottom: 8,
    color: '#334155',
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingLeft: 4,
  },
  bullet: {
    width: 12,
    fontSize: 9.5,
    color: '#064e3b',
  },
  bulletText: {
    flex: 1,
    fontSize: 9.5,
    color: '#334155',
  },
  holderBox: {
    backgroundColor: '#f8fafc',
    border: '0.5 solid #cbd5e1',
    padding: 10,
    marginTop: 6,
    marginBottom: 12,
  },
  holderLabel: {
    fontSize: 7.5,
    color: '#64748b',
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  holderValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  table: {
    border: '0.5 solid #94a3b8',
    marginTop: 4,
    marginBottom: 14,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#064e3b',
    borderBottom: '0.5 solid #064e3b',
  },
  tableHeaderCell: {
    flex: 1,
    padding: 6,
    fontSize: 8,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '0.5 solid #e2e8f0',
  },
  tableRowAlt: {
    flexDirection: 'row',
    borderBottom: '0.5 solid #e2e8f0',
    backgroundColor: '#f8fafc',
  },
  tableCellLabel: {
    width: '32%',
    padding: 7,
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#475569',
    borderRight: '0.5 solid #e2e8f0',
  },
  tableCellValue: {
    width: '68%',
    padding: 7,
    fontSize: 9,
    color: '#0f172a',
  },
  validityNote: {
    fontSize: 8.5,
    fontStyle: 'italic',
    color: '#475569',
    marginTop: 6,
    marginBottom: 14,
    padding: 8,
    backgroundColor: '#ecfdf5',
    border: '0.5 solid #a7f3d0',
  },
  footerSection: {
    marginTop: 'auto',
    paddingTop: 16,
    borderTop: '0.5 solid #cbd5e1',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  qrBlock: {
    alignItems: 'center',
    width: 90,
  },
  qrImage: {
    width: 72,
    height: 72,
    marginBottom: 4,
  },
  qrCaption: {
    fontSize: 6.5,
    color: '#64748b',
    textAlign: 'center',
  },
  signBlock: {
    alignItems: 'center',
    width: 180,
  },
  signImage: {
    height: 40,
    width: 110,
    marginBottom: 4,
  },
  signLine: {
    borderTop: '0.5 solid #64748b',
    width: '100%',
    marginBottom: 4,
    marginTop: 8,
  },
  signName: {
    fontSize: 8.5,
    fontWeight: 'bold',
    color: '#0f172a',
    textAlign: 'center',
  },
  signTitle: {
    fontSize: 7,
    color: '#64748b',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  pageFooter: {
    fontSize: 6.5,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 10,
  },
});

function formatCertDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' });
}

interface ReachCertificateData {
  certificateNumber: string;
  registrationNumber: string;
  companyName: string;
  companyAddress?: string;
  uuidNumber?: string;
  chemicalName: string;
  casNumber: string;
  ecNumber: string;
  tonnageBand: string;
  issueDate: string;
  expiryDate: string;
  logoUrl?: string | null;
  signatureUrl?: string | null;
  footerText?: string | null;
  accentColor?: string;
}

// React component representing the PDF document layout
const TccDocument: React.FC<{ data: CertificateData }> = ({ data }) => {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify/${data.certificateNumber}`
  )}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.border}>
          {/* Header */}
          <View style={styles.header}>
            {data.logoUrl ? (
              <Image src={data.logoUrl} style={styles.logoPlaceholder} />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: data.accentColor || '#064e3b', marginBottom: 10 }}>
                PHARMEGIC HEALTHCARE
              </Text>
            )}
            <Text style={[styles.title, data.accentColor ? { color: data.accentColor } : {}]}>
              TONNAGE COMPLIANCE CERTIFICATE
            </Text>
            <Text style={styles.subtitle}>TCC REGISTRATION PERMIT</Text>
          </View>

          {/* Certificate Number */}
          <View style={styles.certNumberContainer}>
            <Text style={styles.certNumberLabel}>Certificate Registration No.</Text>
            <Text style={styles.certNumber}>{data.certificateNumber}</Text>
          </View>

          {/* Body */}
          <View style={styles.body}>
            <Text style={styles.statement}>
              This document certifies that the chemical substance specified below has been officially registered and
              authorized for export compliance in accordance with Pharmegic Healthcare safety standards and chemical
              registry policies.
            </Text>

            {/* Grid substance specifications */}
            <View style={styles.grid}>
              <View style={styles.gridRow}>
                <Text style={styles.gridLabel}>Authorized Holder:</Text>
                <Text style={styles.gridValue}>{data.companyName}</Text>
              </View>
              <View style={styles.gridRow}>
                <Text style={styles.gridLabel}>Chemical Name:</Text>
                <Text style={styles.gridValue}>{data.chemicalName}</Text>
              </View>
              <View style={styles.gridRow}>
                <Text style={styles.gridLabel}>CAS Registry Number:</Text>
                <Text style={styles.gridValue}>{data.casNumber}</Text>
              </View>
              <View style={styles.gridRow}>
                <Text style={styles.gridLabel}>EC Number:</Text>
                <Text style={styles.gridValue}>{data.ecNumber || 'Not Classified'}</Text>
              </View>
              <View style={styles.gridRow}>
                <Text style={styles.gridLabel}>Tonnage Band Limit:</Text>
                <Text style={styles.gridValue}>{data.tonnageBand}</Text>
              </View>
              <View style={styles.gridRow}>
                <Text style={styles.gridLabel}>Authorized Quantity:</Text>
                <Text style={styles.gridValue}>{data.quantityMt} Metric Tons (MT)</Text>
              </View>
              <View style={styles.gridRow}>
                <Text style={styles.gridLabel}>Date of Issuance:</Text>
                <Text style={styles.gridValue}>{data.issueDate}</Text>
              </View>
              <View style={styles.gridRow}>
                <Text style={styles.gridLabel}>Date of Expiration:</Text>
                <Text style={styles.gridValue}>{data.expiryDate}</Text>
              </View>
            </View>
          </View>

          {/* Signatures & Verifications */}
          <View style={styles.signatureSection}>
            {/* Left side: QR Code verification */}
            <Image src={qrUrl} style={styles.qrCode} />

            {/* Right side: Authorized Signature */}
            <View style={styles.signatureBox}>
              {data.signatureUrl ? (
                <Image src={data.signatureUrl} style={styles.signatureImage} />
              ) : (
                <View style={{ height: 45 }} />
              )}
              <View style={styles.signatureLine} />
              <Text style={{ fontSize: 9, fontWeight: 'bold' }}>Authorized Compliance Director</Text>
              <Text style={styles.signatoryTitle}>Pharmegic Healthcare</Text>
            </View>
          </View>

          {/* Footer */}
          <Text style={styles.footer}>
            {data.footerText || 'Pharmegic Healthcare Compliance Registry. Scanning the QR code verifies authenticity.'}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

const ReachDocument: React.FC<{ data: ReachCertificateData }> = ({ data }) => {
  const accent = data.accentColor || '#064e3b';
  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify/${data.certificateNumber}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verifyUrl)}`;

  const tableRows: { label: string; value: string }[] = [
    { label: 'Substance Name', value: data.chemicalName },
    { label: 'CAS Number', value: data.casNumber },
    { label: 'EC Number', value: data.ecNumber || 'Not Classified' },
    { label: 'Registration Number', value: data.registrationNumber },
    { label: 'Tonnage Band', value: data.tonnageBand },
    { label: 'Issued Date', value: formatCertDate(data.issueDate) },
    { label: 'Validated Until', value: formatCertDate(data.expiryDate) },
  ];

  return (
    <Document>
      <Page size="A4" style={rcStyles.page}>
        <View style={rcStyles.outerFrame}>
          {/* Letterhead */}
          <View style={rcStyles.letterhead}>
            {data.logoUrl ? (
              <Image src={data.logoUrl} style={rcStyles.logo} />
            ) : (
              <Text style={[rcStyles.orgName, { color: accent }]}>Pharmegic Healthcare</Text>
            )}
            <Text style={[rcStyles.mainTitle, { color: accent }]}>REACH Compliance Certificate</Text>
            <Text style={rcStyles.templateRef}>Document Template CT-2026 · RC Certificate</Text>
          </View>

          {/* Certificate meta */}
          <View style={rcStyles.metaRow}>
            <View style={rcStyles.metaBlock}>
              <Text style={rcStyles.metaLabel}>Certificate Reference No.</Text>
              <Text style={rcStyles.metaValue}>{data.certificateNumber}</Text>
              {data.uuidNumber ? (
                <>
                  <Text style={[rcStyles.metaLabel, { marginTop: 6 }]}>Client UUID</Text>
                  <Text style={rcStyles.metaValue}>{data.uuidNumber}</Text>
                </>
              ) : null}
            </View>
            <View style={rcStyles.metaBlock}>
              <Text style={rcStyles.metaLabel}>Issue Date</Text>
              <Text style={rcStyles.metaValue}>{formatCertDate(data.issueDate)}</Text>
              <Text style={[rcStyles.metaLabel, { marginTop: 6 }]}>Validated Until</Text>
              <Text style={rcStyles.metaValue}>{formatCertDate(data.expiryDate)}</Text>
            </View>
          </View>

          <Text style={rcStyles.salutation}>TO WHOM IT MAY CONCERN</Text>

          <Text style={rcStyles.paragraph}>
            This REACH Compliance Certificate (RC Certificate) is issued to confirm that the chemical substance
            identified herein is registered and compliant with the applicable chemical safety and registration
            requirements. This document is issued under Pharmegic Healthcare compliance authority and serves as
            mandatory prerequisite documentation before application for a Tonnage Compliance Certificate (TCC).
          </Text>

          <View style={rcStyles.bulletRow}>
            <Text style={rcStyles.bullet}>•</Text>
            <Text style={rcStyles.bulletText}>
              Regulation (EC) No 1907/2006 — Registration, Evaluation, Authorisation and Restriction of Chemicals (REACH)
            </Text>
          </View>
          <View style={rcStyles.bulletRow}>
            <Text style={rcStyles.bullet}>•</Text>
            <Text style={rcStyles.bulletText}>
              Turkish KKDIK Regulation on Registration, Evaluation, Authorisation and Restriction of Chemicals
            </Text>
          </View>

          <Text style={rcStyles.sectionHeading}>Authorized Holder</Text>
          <View style={rcStyles.holderBox}>
            <Text style={rcStyles.holderLabel}>Company Name</Text>
            <Text style={rcStyles.holderValue}>{data.companyName}</Text>
            {data.companyAddress ? (
              <>
                <Text style={[rcStyles.holderLabel, { marginTop: 6 }]}>Registered Address</Text>
                <Text style={{ fontSize: 9, color: '#334155' }}>{data.companyAddress}</Text>
              </>
            ) : null}
          </View>

          <Text style={rcStyles.sectionHeading}>Substance Registration Details</Text>
          <View style={rcStyles.table}>
            {tableRows.map((row, idx) => (
              <View key={row.label} style={idx % 2 === 0 ? rcStyles.tableRow : rcStyles.tableRowAlt}>
                <Text style={rcStyles.tableCellLabel}>{row.label}</Text>
                <Text style={rcStyles.tableCellValue}>{row.value}</Text>
              </View>
            ))}
          </View>

          <Text style={rcStyles.validityNote}>
            This RC Certificate is valid from the Issued Date until the Validated Until date stated above.
            Export and TCC permit applications may only be submitted for substances covered by an active,
            non-expired RC Certificate. Renewal is required upon expiry.
          </Text>

          <Text style={rcStyles.paragraph}>
            The authorized holder named above is confirmed as the downstream user for the registered substance.
            Pharmegic Healthcare verifies registration status at the time of issuance. The customer remains
            responsible for ensuring continued compliance with all applicable regulatory requirements.
          </Text>

          {/* Signature & verification */}
          <View style={rcStyles.footerSection}>
            <View style={rcStyles.qrBlock}>
              <Image src={qrUrl} style={rcStyles.qrImage} />
              <Text style={rcStyles.qrCaption}>Scan to verify authenticity</Text>
            </View>
            <View style={rcStyles.signBlock}>
              {data.signatureUrl ? (
                <Image src={data.signatureUrl} style={rcStyles.signImage} />
              ) : (
                <View style={{ height: 40 }} />
              )}
              <View style={rcStyles.signLine} />
              <Text style={rcStyles.signName}>Authorized Compliance Director</Text>
              <Text style={rcStyles.signTitle}>Pharmegic Healthcare</Text>
            </View>
          </View>

          <Text style={rcStyles.pageFooter}>
            {data.footerText ||
              'Pharmegic Healthcare Compliance Division · RC Certificate Registry · Template CT-2026 · This document is electronically generated and valid without physical stamp when verified via QR code.'}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

// Main function compiling the React PDF component to a binary buffer
export async function generateCertificatePdf(data: CertificateData): Promise<Buffer> {
  const doc = React.createElement(TccDocument, { data });
  const pdfBuffer = await renderToBuffer(doc as any);
  return pdfBuffer;
}

export async function generateReachCertificatePdf(data: ReachCertificateData): Promise<Buffer> {
  const doc = React.createElement(ReachDocument, { data });
  const pdfBuffer = await renderToBuffer(doc as any);
  return pdfBuffer;
}
