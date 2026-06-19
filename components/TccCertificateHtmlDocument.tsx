import type { CSSProperties, ReactNode } from 'react';
import type { TccCertificateHtmlData } from '@/lib/tcc-certificate-html-data';
import { TCC_LEGAL_PARAGRAPH } from '@/lib/tcc-certificate-html-data';
import { REACH_CERT_A4_CSS_VARS } from '@/lib/reach-certificate-a4';

type TccCertificateHtmlDocumentProps = {
  data: TccCertificateHtmlData;
};

const OR_NAME = 'PHARMEGIC HEALTHCARE LIMITED';

function TccCertPageShell({
  data,
  page,
  children,
}: {
  data: TccCertificateHtmlData;
  page: 1 | 2;
  children: ReactNode;
}) {
  const style = {
    ...REACH_CERT_A4_CSS_VARS,
    '--reach-accent': data.accentColor,
  } as CSSProperties;

  return (
    <div className={`tcc-cert-page tcc-cert-page-${page}`} style={style} data-tcc-cert-root>
      <div className="tcc-cert-frame">
        <div className="tcc-cert-body">{children}</div>
        {page === 2 ? (
          <div className="tcc-footer-slot">
            {data.signatureUrl ? (
              <div className="tcc-seal-wrap">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={data.signatureUrl} alt="Certificate seal" className="tcc-seal-image" />
              </div>
            ) : null}
            <footer className="tcc-cert-footer">
              <p className="tcc-footer-line tcc-footer-company">{data.footerLines[0]}</p>
              <p className="tcc-footer-line">{data.footerLines[1]}</p>
              <p className="tcc-footer-line">{data.footerLines[2]}</p>
            </footer>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** TCC certificate markup — FULL & FINAL two-page layout. */
export default function TccCertificateHtmlDocument({ data }: TccCertificateHtmlDocumentProps) {
  return (
    <div className="tcc-cert-document">
      <TccCertPageShell data={data} page={1}>
        <header className="tcc-cert-header">
          {data.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.logoUrl} alt="Pharmegic Healthcare" className="tcc-brand-logo" />
          ) : null}
        </header>

        <h1 className="tcc-cert-title">EU REACH TONNAGE COVERAGE CERTIFICATE</h1>

        <p className="tcc-cert-intro">
          In compliance with Regulation (EC) No 1907/2006 of the European Parliament and of the
          Council of 18 December 2006 concerning the Registration, Evaluation, Authorisation and
          Restriction of Chemicals (REACH), we hereby confirm that:
        </p>

        <div className="tcc-manufacturer-box">
          <p className="tcc-manufacturer-label">NON-EU MANUFACTURER</p>
          <p className="tcc-manufacturer-name">{data.companyName}</p>
          <p className="tcc-manufacturer-address">{data.manufacturerAddress}</p>
          <p className="tcc-appointment-text">
            has appointed <strong>{OR_NAME}</strong> as its Only Representative
          </p>
        </div>

        <h2 className="tcc-section-title">Registered Substance Details</h2>

        <table className="tcc-substance-table">
          <tbody>
            <tr>
              <th>Substance Name</th>
              <td>{data.chemicalName}</td>
            </tr>
            <tr>
              <th>CAS Number</th>
              <td>{data.casNumber}</td>
            </tr>
            <tr>
              <th>EC Number</th>
              <td>{data.ecNumber}</td>
            </tr>
            <tr>
              <th>Tonnage Band</th>
              <td>{data.tonnageBand}</td>
            </tr>
            <tr>
              <th>UUID</th>
              <td>{data.uuidNumber}</td>
            </tr>
          </tbody>
        </table>

        <div className="tcc-reg-number-box">
          <span className="tcc-reg-label">Registration Number</span>
          <span className="tcc-reg-value">
            <span className="tcc-reg-pipe">|</span>
            {data.registrationNumber}
          </span>
        </div>

        <p className="tcc-legal-text">{TCC_LEGAL_PARAGRAPH}</p>

        <p className="tcc-continued-note">Certificate Continued on next page</p>
      </TccCertPageShell>

      <TccCertPageShell data={data} page={2}>
        <div className="tcc-party-columns">
          <div className="tcc-party-box">
            <h3 className="tcc-party-title">Exporter Information</h3>
            <p className="tcc-party-name">{data.companyName}</p>
            <p className="tcc-party-address">{data.exporterFullAddress}</p>
          </div>
          <div className="tcc-party-box">
            <h3 className="tcc-party-title">EU Importer Information</h3>
            <p className="tcc-party-name">{data.euImporterName}</p>
            <p className="tcc-party-address">{data.euImporterAddr1}</p>
            <p className="tcc-party-address">{data.euImporterAddr2}</p>
            <p className="tcc-party-address">{data.euImporterAddr3}</p>
          </div>
        </div>

        <h2 className="tcc-section-title">Imported Product Information</h2>

        <table className="tcc-substance-table tcc-import-table">
          <tbody>
            <tr>
              <th>Substance Name</th>
              <td>{data.chemicalName}</td>
            </tr>
            <tr>
              <th>CAS Number</th>
              <td>{data.casNumber}</td>
            </tr>
            <tr>
              <th>EC Number</th>
              <td>{data.ecNumber}</td>
            </tr>
            <tr>
              <th>Registration Number</th>
              <td>{data.registrationNumber}</td>
            </tr>
          </tbody>
        </table>

        <div className="tcc-shipment-row">
          <div className="tcc-shipment-item">
            <span className="tcc-shipment-label">Volume Covered</span>
            <span className="tcc-shipment-value">{data.volumeMt}</span>
          </div>
          <div className="tcc-shipment-item">
            <span className="tcc-shipment-label">Invoice No.</span>
            <span className="tcc-shipment-value">{data.invoiceNo}</span>
          </div>
          <div className="tcc-shipment-item">
            <span className="tcc-shipment-label">P.O. No.</span>
            <span className="tcc-shipment-value">{data.poNo}</span>
          </div>
        </div>

        <div className="tcc-date-section">
          <div className="tcc-date-box">
            <div className="tcc-date-label">DATE OF ISSUE</div>
            <div className="tcc-date-value">{data.exportDateDisplay}</div>
          </div>
          <div className="tcc-date-box right">
            <div className="tcc-date-box-inner">
              <div className="tcc-date-label">VALID UPTO</div>
              <div className="tcc-date-value red">{data.validUntilDateDisplay}</div>
            </div>
          </div>
        </div>

        <div className="tcc-cert-number-box">
          <span className="tcc-cert-number-label">Certificate Number</span>
          <span className="tcc-cert-number-value">{data.certificateNumber}</span>
        </div>

        <p className="tcc-end-mark">End of Certificate</p>
      </TccCertPageShell>
    </div>
  );
}
