import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'

import { AppShell } from '@/components/layout/app-shell'
import { tools } from '@/config/tools'
import { useTheme } from '@/hooks/use-theme'
import { ComingSoonPage } from '@/pages/coming-soon-page'
import { HomePage } from '@/pages/home-page'
import { JsonFormatterPage } from '@/pages/json-formatter-page'
import { JsonMinifierPage } from '@/pages/json-minifier-page'
import { JsonStringifyPage } from '@/pages/json-stringify-page'
import { JsonSorterPage } from '@/pages/json-sorter-page'
import { JsonComparePage } from '@/pages/json-compare-page'
import { JsonToGoPage } from '@/pages/json-to-go-page'
import { JsonToTypeScriptPage } from '@/pages/json-to-typescript-page'
import { JsonXmlConverterPage } from '@/pages/json-xml-converter-page'
import { ColorConverterPage, DateFormatterPage, NumberBaseConverterPage } from '@/pages/value-converters-pages'
import { NumbersToLettersPage } from '@/pages/numbers-to-letters-page'
import { RomanNumeralDatePage } from '@/pages/roman-numeral-date-page'
import { StrongPasswordGeneratorPage } from '@/pages/strong-password-generator-page'
import { JsonValidatorPage } from '@/pages/json-validator-page'
import { JwtDecoderPage } from '@/pages/jwt-decoder-page'
import { BarcodePage, QrCodePage } from '@/pages/code-generators-pages'
import { JsonToCsvPage, JsonToYamlPage } from '@/pages/json-converters-pages'
import { JsonDataGeneratorPage } from '@/pages/json-data-generator-page'
import { ImageCropPage } from '@/pages/image-crop-page'
import { ImageResizePage } from '@/pages/image-resize-page'

const ImageRemoveBackgroundPage = lazy(() =>
  import('@/pages/image-remove-background-page').then((module) => ({ default: module.ImageRemoveBackgroundPage })),
)
const ReadmeBuilderPage = lazy(() =>
  import('@/pages/readme-builder-page').then((module) => ({ default: module.ReadmeBuilderPage })),
)
import { SqlFormatterPage, SqlInsertPage, SqlMinifierPage } from '@/pages/sql-tools-pages'
import { CreateTableTypesPage, SqlParametersPage, SqlSyntaxCheckerPage } from '@/pages/sql-advanced-pages'
import { SqlInClausePage } from '@/pages/sql-in-clause-page'
import { LicensePage } from '@/pages/license-page'
import { PrivacyPage } from '@/pages/privacy-page'
import { Base64Page, HtmlEncodeDecodePage, RandomStringPage, UnixTimestampPage, UrlEncodeDecodePage, UuidPage } from '@/pages/quick-tools-pages'
import { XmlFormatterPage } from '@/pages/xml-formatter-page'
import { XmlValidatorPage, XmlViewerPage } from '@/pages/xml-tools-pages'
import { JoinTextPage, MakeOneLinePage, MarkdownPage, RemoveSpacesPage, SplitTextPage, TextDecorationPage } from '@/pages/text-tools-pages'

export default function App() {
  const { mode } = useTheme()

  return (
    <>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/formatters/json" element={<JsonFormatterPage />} />
          <Route path="/formatters/json-minify" element={<JsonMinifierPage />} />
          <Route path="/formatters/json-validator" element={<JsonValidatorPage />} />
          <Route path="/formatters/json-stringify" element={<JsonStringifyPage />} />
          <Route path="/formatters/json-sorter" element={<JsonSorterPage />} />
          <Route path="/formatters/json-compare" element={<JsonComparePage />} />
          <Route path="/json/generator" element={<JsonDataGeneratorPage />} />
          <Route path="/formatters/xml" element={<XmlFormatterPage />} />
          <Route path="/xml/minify" element={<XmlFormatterPage title="XML Minify" description="Compact XML and validate it before sharing." storageKey="xml-minifier" />} />
          <Route path="/xml/viewer" element={<XmlViewerPage />} />
          <Route path="/xml/validator" element={<XmlValidatorPage />} />
          <Route path="/xml/wsdl-formatter" element={<XmlFormatterPage title="WSDL Formatter" description="Beautify and validate WSDL XML documents." storageKey="wsdl-formatter" />} />
          <Route path="/xml/soap-formatter" element={<XmlFormatterPage title="SOAP Formatter" description="Beautify and validate SOAP XML messages." storageKey="soap-formatter" />} />
          <Route path="/sql/formatter" element={<SqlFormatterPage />} />
          <Route path="/sql/minify" element={<SqlMinifierPage />} />
          <Route path="/sql/parameters" element={<SqlParametersPage />} />
          <Route path="/sql/create-table-types" element={<CreateTableTypesPage />} />
          <Route path="/sql/syntax-checker" element={<SqlSyntaxCheckerPage />} />
          <Route path="/sql/insert" element={<SqlInsertPage />} />
          <Route path="/formatters/sql-in" element={<SqlInClausePage />} />
          <Route path="/text-tools/remove-spaces" element={<RemoveSpacesPage />} />
          <Route path="/text-tools/make-one-line" element={<MakeOneLinePage />} />
          <Route path="/text-tools/text-decoration" element={<TextDecorationPage />} />
          <Route path="/text-tools/markdown" element={<MarkdownPage />} />
          <Route path="/text-tools/split-text" element={<SplitTextPage />} />
          <Route path="/text-tools/join-text" element={<JoinTextPage />} />
          <Route
            path="/text-tools/readme-builder"
            element={
              <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Loading…</p>}>
                <ReadmeBuilderPage />
              </Suspense>
            }
          />
          <Route path="/encode-decode/base64" element={<Base64Page />} />
          <Route path="/encode-decode/url" element={<UrlEncodeDecodePage />} />
          <Route path="/encode-decode/html" element={<HtmlEncodeDecodePage />} />
          <Route path="/encode-decode/jwt" element={<JwtDecoderPage />} />
          <Route path="/generators/uuid" element={<UuidPage />} />
          <Route path="/generators/qr-code" element={<QrCodePage />} />
          <Route path="/generators/barcode" element={<BarcodePage />} />
          <Route path="/generators/random-string" element={<RandomStringPage />} />
          <Route path="/generators/strong-password" element={<StrongPasswordGeneratorPage />} />
          <Route path="/converters/unix-timestamp" element={<UnixTimestampPage />} />
          <Route path="/converters/json-to-yaml" element={<JsonToYamlPage />} />
          <Route path="/converters/json-to-csv" element={<JsonToCsvPage />} />
          <Route path="/converters/json-to-go" element={<JsonToGoPage />} />
          <Route path="/converters/json-to-typescript" element={<JsonToTypeScriptPage />} />
          <Route path="/converters/json-xml" element={<JsonXmlConverterPage />} />
          <Route path="/converters/number-base" element={<NumberBaseConverterPage />} />
          <Route path="/converters/numbers-to-letters" element={<NumbersToLettersPage />} />
          <Route path="/converters/color" element={<ColorConverterPage />} />
          <Route path="/converters/date-formatter" element={<DateFormatterPage />} />
          <Route path="/converters/roman-numeral-date" element={<RomanNumeralDatePage />} />
          <Route path="/images/crop" element={<ImageCropPage />} />
          <Route path="/images/resize" element={<ImageResizePage />} />
          <Route
            path="/images/remove-background"
            element={
              <Suspense fallback={<p className="p-4 text-sm text-muted-foreground">Loading…</p>}>
                <ImageRemoveBackgroundPage />
              </Suspense>
            }
          />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/license" element={<LicensePage />} />
          {tools
            .filter((tool) => tool.comingSoon)
            .map((tool) => (
              <Route key={tool.id} path={tool.path} element={<ComingSoonPage tool={tool} />} />
            ))}
        </Route>
      </Routes>
      <Toaster theme={mode} position="bottom-right" richColors closeButton />
    </>
  )
}
