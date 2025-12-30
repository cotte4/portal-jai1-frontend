import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminClientDetail } from './admin-client-detail';

describe('AdminClientDetail', () => {
  let component: AdminClientDetail;
  let fixture: ComponentFixture<AdminClientDetail>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminClientDetail]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminClientDetail);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
