

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import axios from 'axios';
import AccessDenied from '../components/AccessDenied';
import { base_url } from '../api/index';
import { Helmet } from 'react-helmet';
import PasswordScreen from '../components/ScreenPassword';
const getHeaders = () => ({
    headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
        "Content-Type": "application/json",
        Accept: "application/json",
    },
});

const formatDuration = (days, hours, minutes) => {
    let result = '';

    if (parseInt(days) > 0) {
        result += `${days} g `;
    }
    if (parseInt(hours) > 0) {
        result += `${hours} st `;
    }
    if (parseInt(minutes) > 0) {
        result += `${minutes} d`;
    }

    return result.trim() || '1 d'; // Default to '1 d' if all are zero
};

function GunlukKasa() {
    const [data, setData] = useState([]);
    const [dataTotal, setDataTotal] = useState({});
    const [modalData, setModalData] = useState(null);

    console.log("modalData",modalData);
    console.log("data",data);
    

    // Filter state
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [paymentType, setPaymentType] = useState('');
    const [accessDenied, setAccessDenied] = useState(false);
    const [ActiveUser, setActiveUser] = useState(false);

    
    const fetchKasa = () => {
        const params = new URLSearchParams();
        if (startDate) params.append('open_date', startDate);
        if (endDate) params.append('close_date', endDate);
        if (paymentType) params.append('type', paymentType);
    
        axios.get(`${base_url}/payments`, getHeaders())
            .then(response => {
                const sortedData = response.data.payments
                    .map(item => ({
                        ...item,
                        duration: formatDuration(item.days_taken, item.hours_taken, item.minutes_taken),
                    }))
                    .sort((a, b) => new Date(b.open_date) - new Date(a.open_date)); // Yeni → Eski
    
                setData(sortedData);
                setDataTotal({
                    totalKasa: response.data.total_amount,
                    totalCash: response.data.total_cash,
                    totalBank: response.data.total_bank
                });
            })
            .catch(error => {
                if (error.response && error.response.status === 403 && error.response.data.message === "User does not belong to any  active restaurant.") {
                    setActiveUser(true);
                }
                if (error.response && error.response.status === 403 && error.response.data.message === "Forbidden") {
                    setAccessDenied(true);
                } else {
                    console.error('Error fetching orders:', error);
                }
            });
    };
    

    useEffect(() => {
        fetchKasa();
    }, []);

    const resetFilters = () => {
        setStartDate('');
        setEndDate('');
        setStartTime('');
        setEndTime('');
        setPaymentType('');
        fetchKasa();
    };

    const exportToExcel = () => {
        const ws = XLSX.utils.json_to_sheet(data.map(d => ({
            Masa: d.order_name,
            Açılış: d.open_date,
            Bağlanma: d.close_date,
            Süre: d.duration,
            Toplam: d.total_amount,
            ÖdemeTipi: d.type,
            Personel: d.user_name
        })));
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Kasa Raporu");
        XLSX.writeFile(wb, "kasa_raporu.xlsx");
    };

    const exportToPDF = () => {
        const doc = new jsPDF();
        doc.text('Kasa Raporu', 14, 16);

        const tableData = data.map(d => [
            d.order_name,
            d.open_date,
            d.close_date,
            d.duration,
            d.total_amount,
            d.type,
            d.user_name
        ]);

        doc.autoTable({
            head: [['Masa', 'Açılış', 'Bağlanma', 'Müddət', 'Cəmİ', 'Ödəniş növü', 'İşçi']],
            body: tableData,
            startY: 24
        });

        doc.save('kasa_raporu.pdf');
    };

    const printReport = () => {
        const printContent = `
            <html>
            <head>
                <title>Kasa Raporu</title>
                <style>
                    body { font-family: Arial, sans-serif; }
                    .container { max-width: 800px; margin: auto; }
                    .header { text-align: center; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { padding: 10px; border: 1px solid #000; text-align: left; }
                    th { background-color: #f4f4f4; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Nağd pul hesabatı</h1>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Masa/Ad soyad</th>
                                <th>Açılış</th>
                                <th>Bağlanma</th>
                                <th>Müddət</th>
                                <th>Cəmi</th>
                                <th>Ödəniş növü</th>
                                <th>İşçi</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${data.map(item => `
                                <tr>
                                    <td>${item.order_name}</td>
                                    <td>${item.open_date}</td>
                                    <td>${item.close_date}</td>
                                    <td>${item.duration}</td>
                                    <td>${item.total_amount}</td>
                                    <td>${item.type === "cash" ? "Avans" : item.type === "bank" ? "Bank köçürməsi" : "Hissə-hissə ödəyin"}</td>
                                    <td>${item.user_name}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div>
                        <h3>Toplam</h3>
                        <table>
                            <tr>
                                <th>Ümumi pul/th>
                                <td>${dataTotal.totalKasa ?? 0}</td>
                            </tr>
                            <tr>
                                <th>Ümumi avans</th>
                                <td>${dataTotal.totalCash ?? 0}</td>
                            </tr>
                            <tr>
                                <th>Ümumi Bank köçürməsi</th>
                                <td>${dataTotal.totalBank ?? 0}</td>
                            </tr>
                        </table>
                    </div>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '', 'height=600,width=800');
        printWindow.document.open();
        printWindow.document.write(printContent);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    };

    const showModal = (item) => {
        setModalData(item);
    };

    const hideModal = () => {
        setModalData(null);
    };

    const handleDelete = (orderId) => {
        axios.delete(`${base_url}/order/${orderId}/payments`, getHeaders())
            .then(() => {
                setData(data.filter(item => item.id !== orderId));
                hideModal();
                fetchKasa();
            })
            .catch(error => {
                if (error.response && error.response.status === 403 && error.response.data.message === "User does not belong to any  active restaurant.") {
                    setActiveUser(true); // Set access denied if response status is 403
                }
                if (error.response && error.response.status === 403 && error.response.data.message === "Forbidden") {
                    setAccessDenied(true); // Set access denied if response status is 403
                } else {
                    console.error('Error fetching orders:', error);
                }
            });
    };
    // if (ActiveUser) return <DontActiveAcount onClose={setActiveUser}/>;
    if (accessDenied) return <AccessDenied onClose={() => setAccessDenied(false)} />;

    return (
        <>
        <PasswordScreen/>
                   <Helmet>
        <title> Kassa | Smartcafe</title>
        <meta name="description" content='Restoran proqramı | Kafe - Restoran idarə etmə sistemi ' />
      </Helmet>
        <section className='p-4'>
            <div className='rounded border'>
                <div className='p-3 border-b bg-[#fafbfc]'>
                    <h3 className='font-semibold text-lg'>Kasa hisesi</h3>
                </div>
                <div className='p-3 bg-white flex flex-col sm:flex-row gap-5'>
                    {/* Filter Section */}
                    <div className='p-3 border rounded bg-[#fafbfc] w-full md:w-1/4 sm:w-4/4 '>
                        <div className='flex flex-col mb-5'>
                            <h3 className='text-sm font-semibold mb-2'>Başlanğıc</h3>
                            <input
                                className='border rounded py-2 px-3 w-full mb-2 outline-none text-sm font-medium'
                                type="date"
                                name="startDate"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                            <input
                                className='border rounded py-2 px-3 w-full outline-none text-sm font-medium'
                                type="time"
                                name="startTime"
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                            />
                        </div>
                        <div className='flex flex-col mb-5'>
                            <h3 className='text-sm font-semibold mb-2'>Bitmə tarixi</h3>
                            <input
                                className='border rounded py-2 px-3 w-full mb-2 outline-none text-sm font-medium'
                                type="date"
                                name="endDate"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                            <input
                                className='border rounded py-2 px-3 w-full outline-none text-sm font-medium'
                                type="time"
                                name="endTime"
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                            />
                        </div>

                        <div className='flex flex-col mb-5'>
                            <h3 className='text-sm font-semibold mb-2'>Ödeme növü</h3>
                            <select
                                className='border rounded py-2 px-3 w-full outline-none text-sm font-medium'
                                name="paymentType"
                                value={paymentType}
                                onChange={(e) => setPaymentType(e.target.value)}
                            >
                                <option value="">Hamısı</option>
                                <option value="cash">Nağd pul</option>
                                <option value="bank">Kredit kartı</option>
                            </select>
                        </div>

                        <div className='flex flex-col md:flex-row gap-3 flex-wrap'>
                            <button
                                className='rounded py-2 px-4 bg-red-600 text-white'
                                onClick={fetchKasa}
                            >
                                Filtr
                            </button>
                            <button
                                className='rounded py-2 px-4 bg-blue-500 text-white'
                                onClick={resetFilters}
                            >
                                Temizle
                            </button>
                            <button
                                className='flex items-center gap-2 rounded py-2 px-4 bg-slate-900 text-white'
                                onClick={printReport}
                            >
                                <i className="fa-solid fa-print"></i> Yazdır
                            </button>
                        </div>
                    </div>
                    {/* Data Table Section */}
                    <div className='p-3 border rounded w-full bg-white'>
                        <div className='flex flex-col md:flex-row gap-3 mb-3'>
                            <button
                                className='rounded py-2 px-4 bg-zinc-600 text-white'
                                onClick={exportToExcel}
                            >
                                EXCEL
                            </button>
                            <button
                                className='rounded py-2 px-4 bg-zinc-600 text-white'
                                onClick={exportToPDF}
                            >
                                PDF
                            </button>
                        </div>
                        {/* <table className='w-full text-left border rounded bg-[#fafbfc] mb-3'>
                            <thead className='border-b'>
                                <tr>
                                    <th className='p-2 md:p-3'>Masa/Ad soyad</th>
                                    <th className='p-2 md:p-3'>Açılış</th>
                                    <th className='p-2 md:p-3'>Bağlanma</th>
                                    <th className='p-2 md:p-3'>Süre</th>
                                    <th className='p-2 md:p-3'>Toplam</th>
                                    <th className='p-2 md:p-3'>Ödeme tip</th>
                                    <th className='p-2 md:p-3'>Personel</th>
                                    <th className='p-2 md:p-3'>Detay</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((item) => (
                                    <tr key={item.id}>
                                        <td className='p-2 md:p-3'>{item.order_name}</td>
                                        <td className='p-2 md:p-3'>{item.open_date}</td>
                                        <td className='p-2 md:p-3'>{item.close_date}</td>
                                        <td className='p-2 md:p-3'>{item.duration}</td>
                                        <td className='p-2 md:p-3'>{item.total_amount}</td>
                                        <td className='p-2 md:p-3'>{item.type === "cash" ? "Peşin" : item.type === "bank" ? "Banka havalesi" : "Parça parça öde"}</td>
                                        <td className='p-2 md:p-3'>{item.user_name}</td>
                                        <td className='p-2 md:p-3'>
                                            <button
                                                className='rounded py-1 px-3 bg-blue-600 text-white'
                                                onClick={() => showModal(item)}
                                            >
                                                Detay
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table> */}
                        <div className='overflow-x-auto'>
    <table className='w-full text-left border rounded bg-[#fafbfc] mb-3'>
        <thead className='border-b'>
            <tr>
                <th className='p-2 md:p-3'>Masa/Ad soyad</th>
                <th className='p-2 md:p-3'>Açılış</th>
                <th className='p-2 md:p-3'>Bağlanma</th>
                <th className='p-2 md:p-3'>Müddət</th>
                <th className='p-2 md:p-3'>Cəmi</th>
                <th className='p-2 md:p-3'>Ödəniş növü</th>
                <th className='p-2 md:p-3'>İşçi</th>
                <th className='p-2 md:p-3'>Ətrfalı</th>
            </tr>
        </thead>
        <tbody>
            {data.map((item) => (
                <tr key={item.id}>
                    <td className='p-2 md:p-3'>{item.order_name}</td>
                    <td className='p-2 md:p-3'>{item.open_date}</td>
                    <td className='p-2 md:p-3'>{item.close_date}</td>
                    <td className='p-2 md:p-3'>{item.duration}</td>
                    <td className='p-2 md:p-3'>{item.total_amount} ₼</td>
                    <td className='p-2 md:p-3'>{item.type === "cash" ? "Avans" : item.type === "bank" ? "Ümumi bank köçürməsi" : "Hissə hissə ödə"}</td>
                    <td className='p-2 md:p-3'>{item.user_name}</td>
                    <td className='p-2 md:p-3'>
                        <button
                            className='rounded py-1 px-3 bg-blue-600 text-white'
                            onClick={() => showModal(item)}
                        >
                            Ətrfalı
                        </button>
                    </td>
                </tr>
            ))}
        </tbody>
    </table>
</div>

                        <div className='w-full md:w-1/3 p-3 border rounded bg-[#fafbfc]'>
                            <h3 className='mb-3 font-bold'>Cəmi</h3>
                            <table className='text-left w-full text-sm'>
                                <tbody>
                                    <tr className='bg-neutral-100'>
                                        <th className='p-3'>Ümumi Kasa</th>
                                        <th className='p-3'>{dataTotal.totalKasa?.toFixed(2) ?? 0} ₼</th>
                                    </tr>
                                    <tr className='bg-neutral-100'>
                                        <th className='p-3'>Ümumi Avans</th>
                                        <th className='p-3'>{dataTotal.totalCash ?? 0} ₼</th>
                                    </tr>
                                    <tr className='bg-neutral-100'>
                                        <th className='p-3'>Ümumi Bank köçürməsi</th>
                                        <th className='p-3'>{dataTotal.totalBank ?? 0} ₼</th>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {modalData && (
                <div className='fixed inset-0 flex items-center justify-center bg-black bg-opacity-50'>
                    <div className='bg-white p-5 rounded shadow-lg w-full md:w-1/2'>
                        <h3 className='text-xl font-bold mb-4'>{modalData.order_name}</h3>
                        <p><strong>Açılış:</strong> {modalData.open_date}</p>
                        <p><strong>Bağlanma:</strong> {modalData.close_date}</p>
                        <p><strong>Müddət:</strong> {modalData.duration}</p>
                        <p><strong>Cəmi:</strong> {modalData.total_amount} ₼</p>
                        <p><strong>Ödəniş növü</strong> {modalData.type}</p>
                        <p><strong>İşçi:</strong> {modalData.user_name}</p>
                        <h4 className='text-lg font-semibold mt-4 mb-2'>Sifarişlər</h4>
<table className='w-full text-left border rounded bg-[#fafbfc]'>
  <thead className='border-b'>
    <tr>
      <th className='p-3'>Adı</th>
      <th className='p-3'>Miqdar</th>
      <th className='p-3'>Qiyməti</th>
    </tr>
  </thead>
  <tbody>
    {modalData?.items && modalData.items.length > 0 ? (
      <>
        {modalData.items.map((item, index) => (
          <tr key={`${item.name}-${index}`} className='border-b'>
            <td className='p-3'>{item.name}</td>
            <td className='p-3'>{item.quantity}</td>
            <td className='p-3'>{item.price}</td>
          </tr>
        ))}
        <tr className='font-semibold'>
          <td className='p-3' colSpan={2}>Cəmi</td>
          <td className='p-3'>{modalData.total_amount}</td>
        </tr>
      </>
    ) : (
      <tr>
        <td className='p-3' colSpan={3}>Sifariş yoxdur</td>
      </tr>
    )}
  </tbody>
</table>


                  
                        <button
                            className='mt-4 px-4 py-2 bg-red-600 text-white rounded'
                            onClick={() => handleDelete(modalData.order_id)}
                        >
                            Sil
                        </button>
                        <button
                            className='mt-4 ml-4 px-4 py-2 bg-blue-500 text-white rounded'
                            onClick={hideModal}
                        >
                            Bağlayın
                        </button>
                    </div>
                </div>
            )}
        </section>
        </>
    );
}

export default GunlukKasa;
