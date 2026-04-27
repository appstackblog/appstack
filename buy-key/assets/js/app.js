(function () {
    function setButtonState(button, loading) {
        if (!button) {
            return;
        }

        if (loading) {
            button.dataset.originalText = button.textContent;
            button.textContent = button.dataset.loading || 'Đang xử lý...';
            button.disabled = true;
        } else if (button.dataset.originalText) {
            button.textContent = button.dataset.originalText;
            button.disabled = false;
        }
    }

    function copyText(text, button) {
        var done = function () {
            if (!button) {
                return;
            }
            var original = button.textContent;
            button.textContent = 'Đã sao chép';
            setTimeout(function () {
                button.textContent = original;
            }, 1400);
        };

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).then(done);
            return;
        }

        var input = document.createElement('textarea');
        input.value = text;
        input.style.position = 'fixed';
        input.style.opacity = '0';
        document.body.appendChild(input);
        input.focus();
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        done();
    }

    document.querySelectorAll('.js-copy').forEach(function (button) {
        button.addEventListener('click', function () {
            copyText(button.getAttribute('data-copy') || '', button);
        });
    });

    document.querySelectorAll('form').forEach(function (form) {
        if (form.id === 'key-check-form') {
            return;
        }
        form.addEventListener('submit', function () {
            setButtonState(form.querySelector('button[type="submit"][data-loading]'), true);
        });
    });

    var checkForm = document.getElementById('key-check-form');
    var checkResult = document.getElementById('key-check-result');
    if (checkForm && checkResult) {
        checkForm.addEventListener('submit', function (event) {
            event.preventDefault();
            var submit = checkForm.querySelector('button[type="submit"]');
            setButtonState(submit, true);
            checkResult.hidden = false;
            checkResult.className = 'result-panel';
            checkResult.textContent = 'Đang kiểm tra key...';

            fetch(checkForm.action, {
                method: 'POST',
                body: new FormData(checkForm),
                headers: {
                    'Accept': 'application/json'
                }
            })
                .then(function (response) {
                    return response.json().then(function (data) {
                        data.httpStatus = response.status;
                        return data;
                    });
                })
                .then(function (data) {
                    checkResult.className = 'result-panel ' + (data.ok ? 'success' : 'danger');
                    var lines = [data.message || 'Hoàn tất.'];
                    if (data.display_status) {
                        lines.push('Trạng thái: ' + data.display_status);
                    }
                    if (data.worker_response) {
                        lines.push('Chi tiết từ Worker:');
                        lines.push(JSON.stringify(data.worker_response, null, 2));
                    }
                    checkResult.textContent = lines.join('\n\n');
                })
                .catch(function () {
                    checkResult.className = 'result-panel danger';
                    checkResult.textContent = 'Hiện chưa thể kiểm tra key. Vui lòng thử lại sau.';
                })
                .finally(function () {
                    setButtonState(submit, false);
                });
        });
    }

    document.querySelectorAll('[data-auto-refresh]').forEach(function (element) {
        var seconds = parseInt(element.getAttribute('data-auto-refresh'), 10);
        if (seconds > 0) {
            setTimeout(function () {
                window.location.reload();
            }, seconds * 1000);
        }
    });
})();
