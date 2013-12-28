$(document).ready(function() {
    $('#faxNumberInput').inputmask('999-99-99',{
        'onincomplete': function() {
            if($('#faxNumberInput').inputmask('unmaskedvalue')) {
                $('#faxNumberGroup').addClass('has-error');
            }
            checkSendFaxAvailability();
        },
        'oncomplete': function() {
            $('#faxNumberGroup').removeClass('has-error');
            checkSendFaxAvailability();
        },
        'oncleared': function() {
            $('#faxNumberGroup').removeClass('has-error');
            checkSendFaxAvailability();
        },
        'showMaskOnHover': false,
        'autoUnmask': true
    });

    $('#btnSelectFile').click(function() {
        $('#file').click();
    });
    $('#file').change(function() {
        var element = $('#fakeInputFileToSend span'),
            fileName = $(this).val().split('\\').pop();
        element.text(fileName);
        element.removeClass('text-muted');
        checkSendFaxAvailability();
    });

    function checkSendFaxAvailability() {
        if ($('#faxNumberInput').inputmask('isComplete') && $('#fakeInputFileToSend span').text().split('.').pop() == 'pdf') {
            $('#btnSendFax').removeAttr('disabled');
        } else {
            $('#btnSendFax').attr('disabled',true);
        }
    }

    $('#btnSendFax').click(function() {

        $('#number').val($('#faxNumberInput').inputmask('unmaskedvalue'));

        sendForm(document.getElementById('newFaxRealForm'));

        $('#number').val('');
        $('#file').val('');

        var element = $('#fakeInputFileToSend span');
        element.text('Выберите файл для отправки');
        element.addClass('text-muted');
        $('#faxNumberInput').val('');

        checkSendFaxAvailability();
    });

});

function sendForm(form) {
    var formData = new FormData(form);
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload', true);
    xhr.send(formData);
}