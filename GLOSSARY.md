# Ruang

Istilah metrik penjualan yang dipakai di dashboard Ruang.

## Language

**Nilai invoice**:
Jumlah nilai invoice pelanggan selain yang dibatalkan atau diarsipkan, berdasarkan tanggal invoice dalam periode terpilih. Angka ini bukan jumlah kas yang diterima.
_Avoid_: Revenue, kas masuk

**Win rate**:
Persentase deal menang dari seluruh deal selesai (menang dan kalah) selama periode terpilih, berdasarkan tanggal penyelesaiannya. Bila belum ada deal selesai, win rate belum tersedia, bukan nol.
_Avoid_: Conversion rate, deal menang dibagi deal baru

**Periode dashboard**:
Rentang kalender bulan ini, bulan lalu, kuartal ini, atau tahun ini dalam WIB. Periode yang masih berjalan berakhir pada waktu sekarang.

**Periode pembanding**:
Rentang kalender sebelumnya dengan bagian waktu berjalan yang setara; akhir rentang tidak melewati akhir kalender periode tersebut. Untuk bulan lalu yang sudah selesai, pembandingnya adalah sebulan penuh sebelumnya.

**Snapshot terkini**:
Kondisi pipeline aktif, invoice belum dibayar atau terlambat, serta aktivitas pada waktu sekarang. Snapshot terkini tidak mengikuti periode dashboard.
