$(document).ready(function() {

    var oTable = $('#faxDataTable').dataTable( {
        "bAutoWidth": false,
        "bLengthChange": false,
        "bPaginate": false,
        "sAjaxSource": "/state",
        "oLanguage": {
            "sUrl": "/translate"
        },
        "aoColumns": [
            { "mData": "uuid" },
            { "mData": "phone" },
            { "mData": "date" },
            { "mData": "status" },
            { "mData": "statusTimeStamp" },
            { "mData": "retry" }
        ],
        "fnInitComplete": function(oSettings, json) {
            this.fnSort([[2,'desc']]);
        }
    } );

    var messageServer = io.connect();

    messageServer.on('updateFaxDataTable', function() {
        oTable.fnReloadAjax();
    });

});
