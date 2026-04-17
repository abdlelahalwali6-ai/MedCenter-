import React from 'react';
import { LabRequest, LabTest } from '@/src/types';
import { formatArabicDate } from '@/src/lib/dateUtils';
import { FlaskConical, User, Calendar, ShieldCheck, MapPin, Phone } from 'lucide-react';

interface LabReportProps {
  request: LabRequest;
  hospitalName?: string;
  hospitalAddress?: string;
  hospitalPhone?: string;
  hospitalLogo?: string;
}

export const LabReport: React.FC<LabReportProps> = ({ 
  request, 
  hospitalName = "مجمع الشفاء الطبي", 
  hospitalAddress = "اليمن - صنعاء - شارع الستين",
  hospitalPhone = "777-000-000",
  hospitalLogo = ""
}) => {
  return (
    <div className="bg-white p-8 max-w-4xl mx-auto shadow-lg print:shadow-none print:p-0" dir="rtl">
      {/* Header */}
      <div className="flex justify-between items-start border-b-2 border-primary pb-6 mb-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center justify-center">
            {hospitalLogo ? (
              <img 
                src={hospitalLogo} 
                alt="Logo" 
                className="w-20 h-20 object-contain" 
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="bg-primary p-3 rounded-xl text-white">
                <FlaskConical size={48} />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">{hospitalName}</h1>
            <p className="text-sm text-slate-500 font-medium flex items-center gap-1 mt-1">
              <MapPin size={14} className="text-primary" /> {hospitalAddress}
            </p>
            <p className="text-sm text-slate-500 font-medium flex items-center gap-1 mt-0.5">
              <Phone size={14} className="text-primary" /> {hospitalPhone}
            </p>
          </div>
        </div>
        <div className="text-left flex flex-col items-end">
          <div className="bg-primary/5 px-4 py-1 rounded-full mb-2">
            <h2 className="text-lg font-black text-primary">تقرير مخبري</h2>
          </div>
          <p className="text-[10px] font-mono text-slate-400">REQUEST ID: {request.id}</p>
          <p className="text-[10px] font-mono text-slate-400">REPORT DATE: {new Date().toLocaleDateString('ar-SA')}</p>
        </div>
      </div>

      {/* Patient Info Card */}
      <div className="grid grid-cols-2 gap-6 bg-slate-50 p-4 rounded-xl border border-slate-100 mb-8">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <User size={16} className="text-primary" />
            <span className="font-bold text-slate-700">اسم المريض:</span>
            <span className="text-slate-900">{request.patientName}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Calendar size={16} className="text-primary" />
            <span className="font-bold text-slate-700">تاريخ الطلب:</span>
            <span className="text-slate-900">{formatArabicDate(request.createdAt)}</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <ShieldCheck size={16} className="text-primary" />
            <span className="font-bold text-slate-700">الطبيب المحول:</span>
            <span className="text-slate-900">{request.doctorName}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <FlaskConical size={16} className="text-primary" />
            <span className="font-bold text-slate-700">الحالة:</span>
            <span className="text-success font-bold">مكتمل</span>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="space-y-8">
        {request.tests.map((test, idx) => (
          <div key={idx} className="border rounded-xl overflow-hidden">
            <div className="bg-slate-100 px-4 py-2 border-b font-bold text-primary flex justify-between">
              <span>{test.name}</span>
              <span className="text-xs font-normal text-secondary">قسم المختبر</span>
            </div>
            
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 text-xs font-bold text-secondary border-b">
                  <th className="px-4 py-2 w-1/3">البند (Parameter)</th>
                  <th className="px-4 py-2">النتيجة (Result)</th>
                  <th className="px-4 py-2">الوحدة (Unit)</th>
                  <th className="px-4 py-2">المجال الطبيعي (Normal Range)</th>
                </tr>
              </thead>
              <tbody>
                {test.items && test.items.length > 0 ? (
                  test.items.map((item, iIdx) => (
                    <tr key={iIdx} className="border-b last:border-0 hover:bg-slate-50/50">
                      <td className="px-4 py-3 text-sm font-medium text-slate-700">{item.name}</td>
                      <td className="px-4 py-3 text-sm font-bold text-primary">{item.result}</td>
                      <td className="px-4 py-3 text-xs text-secondary">{item.unit}</td>
                      <td className="px-4 py-3 text-xs text-secondary">{item.normalRange}</td>
                    </tr>
                  ))
                ) : (
                  <tr className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">النتيجة العامة</td>
                    <td className="px-4 py-3 text-sm font-bold text-primary">{test.result}</td>
                    <td className="px-4 py-3 text-xs text-secondary">{test.unit}</td>
                    <td className="px-4 py-3 text-xs text-secondary">{test.referenceRange}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Footer / Signatures */}
      <div className="mt-16 grid grid-cols-2 gap-20 text-center">
        <div className="border-t pt-4">
          <p className="text-sm font-bold text-slate-700 mb-8">توقيع فني المختبر</p>
          <div className="h-12 border-b border-dashed border-slate-300 w-48 mx-auto"></div>
        </div>
        <div className="border-t pt-4">
          <p className="text-sm font-bold text-slate-700 mb-8">ختم المركز الطبي</p>
          <div className="w-24 h-24 border-2 border-primary/20 rounded-full mx-auto flex items-center justify-center text-[10px] text-primary/30 rotate-12">
            STAMP HERE
          </div>
        </div>
      </div>

      {/* Print Note */}
      <div className="mt-12 text-[10px] text-slate-400 font-mono text-center border-t border-slate-100 pt-4 print:hidden">
        ملاحظة: هذا التقرير تم إنشاؤه إلكترونياً من نظام إدارة {hospitalName}.
      </div>
    </div>
  );
};
