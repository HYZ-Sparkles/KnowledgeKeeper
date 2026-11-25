/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#FDFAF5',
        'paper-2': '#F4F1E8',
        rule: '#E4E0DD',
        'rule-soft': '#EFEBE5',
        ink: '#2C2827',
        'ink-2': '#4B351E',
        mute: '#6F6254',
        faint: '#7E7162',
        amber: '#9E5A2C',
        'amber-fill': '#B08A6B',
        orange: '#A94E15',
        'orange-fill': '#D37035',
        'orange-wash': '#FBEBDD',
        blue: '#326CE5',
        'blue-ink': '#1E48DA',
        'blue-wash': '#D9EBFF',
        green: '#3E7A4E',
        'green-wash': '#DCFCE7',
        red: '#B23A2A',
        'red-wash': '#FAE1DA',
      },
      fontFamily: {
        sans: [
          '-apple-system', 'BlinkMacSystemFont', 'PingFang SC',
          'Hiragino Sans GB', 'Microsoft YaHei', 'Noto Sans SC', 'sans-serif',
        ],
      },
      fontSize: {
        't40': ['40px', { lineHeight: '1.24' }],
        't30': ['30px', { lineHeight: '1.5' }],
        't16': ['16px', { lineHeight: '1.5' }],
        't15': ['15px', { lineHeight: '1.65' }],
        't14': ['14px', { lineHeight: '1.5' }],
        't13_5': ['13.5px', { lineHeight: '1.5' }],
        't12_5': ['12.5px', { lineHeight: '1.4' }],
      },
      borderRadius: {
        '3': '3px',
        '4': '4px',
      },
      spacing: {
        'topbar': '56px',
        'rail-left': '240px',
        'rail-right': '220px',
        'tap': '42px',
      },
    },
  },
  plugins: [],
};
