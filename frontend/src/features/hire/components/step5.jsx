
import { Form } from 'antd'
import { InputDa } from '@shared/ui/Input';
import { useEffect } from 'react';
export default function Step5({ formRef }) {

    const [form] = Form.useForm();
    useEffect(() => {
        if (formRef) {
            formRef.current = form;
        }
    }, [formRef, form]);
    return (
        <div className='flex justify-center my-10'>
            <Form form={form} name="validateOnly" autoComplete="off" className='space-y-4'>
                <InputDa type={'number'} name={'1 Child'} val={'firstChild'} placeholder={'$20.00'} labelText="1 Child"/>
                <InputDa type={'number'} name={'2 Child'} val={'secChild'} placeholder={'$30.00'} labelText="2 Child"/>
                <InputDa type={'number'} name={'3 Child'} val={'thirdChild'} placeholder={'$40.00'} labelText="3 Child"/>
                <InputDa type={'number'} name={'4 Child'} val={'fourthChild'} placeholder={'$50.00'} labelText="4 Child"/>
                <InputDa type={'number'} name={'5 Child or more'} val={'fiveOrMoreChild'} placeholder={'$60.00'} labelText="5 Child or more"/>
            </Form>
        </div>
    )

}