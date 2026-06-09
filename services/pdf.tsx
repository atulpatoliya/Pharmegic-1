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

interface ReachCertificateData {
  certificateNumber: string;
  companyName: string;
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
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(
    `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/verify/${data.certificateNumber}`
  )}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.border}>
          <View style={styles.header}>
            {data.logoUrl ? (
              <Image src={data.logoUrl} style={styles.logoPlaceholder} />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: data.accentColor || '#064e3b', marginBottom: 10 }}>
                PHARMEGIC HEALTHCARE
              </Text>
            )}
            <Text style={[styles.title, data.accentColor ? { color: data.accentColor } : {}]}>
              REACH COMPLIANCE CERTIFICATE
            </Text>
            <Text style={styles.subtitle}>EU REACH REGISTRATION COMPLIANCE — CT 2026</Text>
          </View>

          <View style={styles.certNumberContainer}>
            <Text style={styles.certNumberLabel}>Certificate Registration No.</Text>
            <Text style={styles.certNumber}>{data.certificateNumber}</Text>
          </View>

          <View style={styles.body}>
            <Text style={styles.statement}>
              This document certifies that the chemical substance specified below is registered and compliant with
              EU REACH (Registration, Evaluation, Authorisation and Restriction of Chemicals) requirements. A valid
              REACH Compliance Certificate is mandatory before applying for a Tonnage Compliance Certificate (TCC).
              This certificate remains valid for one (1) year from the date of issuance.
            </Text>

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
                <Text style={styles.gridLabel}>Tonnage Band:</Text>
                <Text style={styles.gridValue}>{data.tonnageBand}</Text>
              </View>
              <View style={styles.gridRow}>
                <Text style={styles.gridLabel}>Date of Issuance:</Text>
                <Text style={styles.gridValue}>{data.issueDate}</Text>
              </View>
              <View style={styles.gridRow}>
                <Text style={styles.gridLabel}>Valid Until (1 Year):</Text>
                <Text style={styles.gridValue}>{data.expiryDate}</Text>
              </View>
            </View>
          </View>

          <View style={styles.signatureSection}>
            <Image src={qrUrl} style={styles.qrCode} />
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

          <Text style={styles.footer}>
            {data.footerText ||
              'Pharmegic Healthcare REACH Compliance Registry. Scan the QR code to verify authenticity. Validity: 1 year.'}
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
