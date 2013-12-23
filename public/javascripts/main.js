$(document).ready(function() {

    var oTable = $('#faxDataTable').dataTable( {
        "bAutoWidth": false,
        "bLengthChange": false,
        "bStateSave": true,
        "bPaginate": false,
        "sAjaxSource": "/fax/state",
        "oLanguage": {
            "sZeroRecords":  "Записи отсутствуют.",
            "sInfo": "Записи с _START_ до _END_ из _TOTAL_ записей",
            "sInfoEmpty":    "Записи с 0 до 0 из 0 записей",
            "sInfoFiltered": "(отфильтровано из _MAX_ записей)"
        },
        "aoColumns": [
            { "mData": "uuid" },
            { "mData": "phone" },
            { "mData": "date" },
            { "mData": "status" },
            { "mData": "statusTimeStamp" },
            { "mData": "retry" }
        ]
    } );

    $('.datatable').each(function(){
        var datatable = $(this);

        var search_input = datatable.closest('.dataTables_wrapper').find('div[id$=_filter] input');
        search_input.attr('placeholder', 'Поиск');
        search_input.addClass('form-control input-sm');

        var length_sel = datatable.closest('.dataTables_wrapper').find('div[id$=_length] select');
        length_sel.addClass('form-control input-sm');
    });

    var messageServer = io.connect('http://localhost');

    messageServer.on('updateFaxDataTable', function() {
        oTable.fnReloadAjax();
    });

});
